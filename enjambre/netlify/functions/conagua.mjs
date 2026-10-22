// Proxy de solo lectura hacia la capa oficial "Cuerpos de agua" de CONAGUA (MapServer/3).
// Carga por área visible y zoom; parámetros validados (host fijo, sin SSRF); respuesta cacheable.
const BASE = 'https://sigagis.conagua.gob.mx/ArcGIS/rest/services/Contexto_hidrol%C3%B3gico/MapServer/3/query';
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export default async (req) => {
  const u = new URL(req.url);
  const bb = (u.searchParams.get('bbox') || '').split(',').map(Number), z = Number(u.searchParams.get('z'));
  if (bb.length !== 4 || bb.some((n) => !Number.isFinite(n)) || !(z >= 8 && z <= 18)) return new Response('bad request', { status: 400 });
  const w = clamp(bb[0], -119, -86), s = clamp(bb[1], 14, 33), e = clamp(bb[2], -119, -86), n = clamp(bb[3], 14, 33);
  if (e <= w || n <= s || (e - w) * (n - s) > 40) return new Response('area', { status: 400 });
  const q = new URLSearchParams({
    f: 'geojson', where: '1=1', geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true',
    maxAllowableOffset: String((360 / (256 * 2 ** z)) * 2), geometryPrecision: '5', resultRecordCount: '400',
  });
  try {
    const r = await fetch(`${BASE}?${q}`, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
    if (!r.ok) return new Response('upstream', { status: 502 });
    const t = await r.text();
    if (t.includes('"error"') && !t.includes('"features"')) return new Response('upstream', { status: 502 });
    return new Response(t, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600, s-maxage=3600' } });
  } catch { return new Response('upstream', { status: 502 }); }
};
export const config = { path: '/api/conagua' };
