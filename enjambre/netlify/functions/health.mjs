// Diagnóstico del despliegue. PROTEGIDO: solo responde si existe la variable HEALTH_TOKEN y la petición la presenta
// en el encabezado "Authorization: Bearer <token>" o en ?token=<token>. Sin HEALTH_TOKEN definido responde 404,
// así que en producción basta con no definirla (o borrarla) para que el endpoint quede deshabilitado.
// Solo devuelve verdadero/falso y códigos de estado; nunca valores de claves.
import { createHash, timingSafeEqual } from 'node:crypto';
import { LAYER, CAPAS, FUENTE, fetchCon } from './conagua.mjs';

const J = (o, s = 200) => new Response(JSON.stringify(o, null, 2), {
  status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});
const intenta = async (fn) => { try { return await fn(); } catch (e) { return { ok: false, error: String((e.cause && e.cause.code) || e.message).slice(0, 80) }; } };
const digest = (s) => createHash('sha256').update(String(s)).digest();   // longitud fija para comparar en tiempo constante

export function autorizado(req, token) {
  if (!token || token.length < 16) return false;                        // un token corto equivale a no tenerlo
  const auth = req.headers.get('authorization') || '';
  const dado = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (new URL(req.url).searchParams.get('token') || '');
  return !!dado && timingSafeEqual(digest(dado), digest(token));
}

export default async (req) => {
  const E = process.env;
  if (!autorizado(req, E.HEALTH_TOKEN)) return J({ error: 'not_found' }, 404);   // indistinguible de una ruta inexistente

  const vars = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'RATE_LIMIT_SALT', 'RESEND_API_KEY', 'NOTIFY_EMAIL_FROM', 'ALLOWED_ORIGIN', 'CONAGUA_CA_PEM']) vars[k] = !!E[k];
  const base = (E.SUPABASE_URL || '').replace(/\/$/, ''), key = E.SUPABASE_SECRET_KEY;
  const db = await intenta(async () => {
    if (!base || !key) return { ok: false, error: 'faltan SUPABASE_URL o SUPABASE_SECRET_KEY' };
    const h = { apikey: key, accept: 'application/openapi+json' }; if (key.startsWith('eyJ')) h.authorization = 'Bearer ' + key;
    const r = await fetch(base + '/rest/v1/', { headers: h, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, status: r.status, error: r.status === 401 || r.status === 403 ? 'clave rechazada' : 'respuesta inesperada' };
    const spec = await r.json().catch(() => ({})), paths = Object.keys(spec.paths || {});
    return {
      ok: paths.includes('/rpc/create_contact_submission'), tabla_contacts: paths.includes('/contacts'),
      funcion_alta: paths.includes('/rpc/create_contact_submission'), funcion_anonimizar: paths.includes('/rpc/anonymize_contact'),
      pista: paths.length ? undefined : 'Ejecuta supabase/schema.sql',
    };
  });
  const capa_agua = await intenta(async () => {
    const r = await fetchCon(`${LAYER}?f=json`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { ok: false, status: r.status };
    const m = await r.json();
    if (m.error) return { ok: false, error: String(m.error.message || '').slice(0, 100) };
    const sub = new Map((m.layers || []).map((l) => [String(l.id), l.name]));
    return { ok: true, fuente: FUENTE, servicio: m.mapName || m.name, subcapas: CAPAS.map((id) => ({ id, nombre: sub.get(id) || '(no existe en el servicio)' })) };
  });
  return J({ funciones_desplegadas: true, variables_definidas: vars, supabase: db, capa_agua });
};
export const config = { path: '/api/health' };
