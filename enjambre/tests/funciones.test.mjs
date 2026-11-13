// Pruebas de las Netlify Functions sin red: `npm test` (Node 20+). fetch se sustituye por un doble que registra las llamadas.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import contacto, { origenPermitido } from '../netlify/functions/submit-contact.mjs';
import health from '../netlify/functions/health.mjs';
import capa, { esriToGeoJSON } from '../netlify/functions/conagua.mjs';

const SITIO = 'https://enjambre.example';
const valido = { nombre: 'Ana Prueba', organizacion: 'Org', correo: 'ana@example.com', interes: 'Apoyo técnico', mensaje: 'Hola', pais: 'MX' };
const post = (cuerpo, h = {}) => new Request(`${SITIO}/api/contact`, {
  method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json', origin: SITIO, host: 'enjambre.example', ...h },
});
let llamadas;
beforeEach(() => {
  llamadas = [];
  globalThis.fetch = async (url, opts) => { llamadas.push({ url: String(url), opts }); return new Response('"id"', { status: 200 }); };
  Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_prueba', RATE_LIMIT_SALT: 'sal-de-prueba-suficientemente-larga' });
  for (const k of ['ALLOWED_ORIGIN', 'RESEND_API_KEY', 'HEALTH_TOKEN']) delete process.env[k];
});

test('contacto: envío válido desde el propio sitio se guarda', async () => {
  const r = await contacto(post(valido));
  assert.equal(r.status, 200);
  assert.equal(llamadas.length, 1);
  const cuerpo = JSON.parse(llamadas[0].opts.body);
  assert.equal(cuerpo.p.pais, 'México');
  assert.match(cuerpo.p_ip_hash, /^[0-9a-f]{64}$/);
});

test('contacto: sin Origin o desde otro sitio → 403 y no toca la base', async () => {
  const sinOrigen = new Request(`${SITIO}/api/contact`, { method: 'POST', body: JSON.stringify(valido), headers: { host: 'enjambre.example' } });
  assert.equal((await contacto(sinOrigen)).status, 403);
  assert.equal((await contacto(post(valido, { origin: 'https://malicioso.example' }))).status, 403);
  assert.equal(llamadas.length, 0);
});

test('contacto: ALLOWED_ORIGIN admite orígenes adicionales (lista separada por comas)', () => {
  process.env.ALLOWED_ORIGIN = 'https://otro.example, https://tercero.example/';
  const req = (o) => new Request(`${SITIO}/api/contact`, { method: 'POST', headers: { origin: o, host: 'enjambre.example' } });
  assert.equal(origenPermitido(req('https://tercero.example')), true);
  assert.equal(origenPermitido(req('https://cuarto.example')), false);
});

test('contacto: sin sal (o sal corta) no guarda nada', async () => {
  process.env.RATE_LIMIT_SALT = 'corta';
  const r = await contacto(post(valido));
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'config' });
  assert.equal(llamadas.length, 0);
});

test('contacto: pin sin consentimiento se rechaza; con consentimiento se redondea a 2 decimales', async () => {
  const sin = await contacto(post({ ...valido, lat: 19.43251, lng: -99.13321 }));
  assert.equal(sin.status, 400);
  const con = await contacto(post({ ...valido, lat: 19.43251, lng: -99.13321, consentimiento_ubicacion: true }));
  assert.equal(con.status, 200);
  const p = JSON.parse(llamadas.at(-1).opts.body).p;
  assert.deepEqual([p.lat, p.lng], [19.43, -99.13]);
});

test('health: 404 sin HEALTH_TOKEN, con token corto o incorrecto', async () => {
  const req = (h = {}, q = '') => new Request(`${SITIO}/api/health${q}`, { headers: h });
  assert.equal((await health(req({}, '?token=cualquiera'))).status, 404);
  process.env.HEALTH_TOKEN = 'corto';
  assert.equal((await health(req({}, '?token=corto'))).status, 404);
  process.env.HEALTH_TOKEN = 'token-de-prueba-1234567890';
  assert.equal((await health(req({ authorization: 'Bearer otro' }))).status, 404);
  assert.equal(llamadas.length, 0);
});

test('capa de agua: valida bbox y zoom; atribuye la fuente real', async () => {
  const req = (q) => new Request(`${SITIO}/api/conagua?${q}`);
  assert.equal((await capa(req('bbox=1,2,3&z=10'))).status, 400);
  assert.equal((await capa(req('bbox=-100,19,-99,20&z=5'))).status, 400);
  globalThis.fetch = async () => new Response(JSON.stringify({ features: [] }), { status: 200 });
  const d = await (await capa(req('bbox=-100,19,-99,20&z=10'))).json();
  assert.equal(d.fuente, 'SEMARNAT');
  assert.equal(d.type, 'FeatureCollection');
});

test('esriToGeoJSON: anillo exterior + hueco → Polygon con hueco', () => {
  const ext = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]], hueco = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]];
  const g = esriToGeoJSON({ features: [{ attributes: { NOMBRE: 'X' }, geometry: { rings: [ext, hueco] } }] });
  assert.equal(g.features[0].geometry.type, 'Polygon');
  assert.equal(g.features[0].geometry.coordinates.length, 2);
});
