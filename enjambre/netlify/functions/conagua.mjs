// Proxy de solo lectura hacia la capa "Cuerpos de agua" de CONAGUA (ArcGIS REST MapServer/3).
// - Pide f=json (lo soportan TODOS los ArcGIS Server; f=geojson solo desde 10.4) y lo convierte aquí a GeoJSON.
// - Carga por área visible (bbox) y zoom; host fijo (sin SSRF); respuesta cacheable.
export const LAYER = 'https://sigagis.conagua.gob.mx/ArcGIS/rest/services/Contexto_hidrol%C3%B3gico/MapServer/3';
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return s / 2; };
const dentro = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

// Esri JSON → GeoJSON. En Esri los anillos exteriores van en sentido horario (área < 0) y los huecos en antihorario.
export function esriToGeoJSON(d) {
  const feats = (d.features || []).map((f) => {
    const g = f.geometry || {}; let geometry = null;
    if (g.rings) {
      const polys = [], huecos = [];
      for (const r of g.rings) { if (r.length < 4) continue; (area(r) < 0 ? polys : huecos).push(r.slice().reverse()); }
      const P = polys.map((o) => [o]);
      for (const h of huecos) { const p = P.find((q) => dentro(h[0], q[0])); if (p) p.push(h); }
      if (P.length) geometry = P.length === 1 ? { type: 'Polygon', coordinates: P[0] } : { type: 'MultiPolygon', coordinates: P };
    } else if (g.paths) geometry = { type: 'MultiLineString', coordinates: g.paths };
    else if (typeof g.x === 'number') geometry = { type: 'Point', coordinates: [g.x, g.y] };
    return geometry ? { type: 'Feature', properties: f.attributes || {}, geometry } : null;
  }).filter(Boolean);
  return { type: 'FeatureCollection', features: feats, exceededTransferLimit: !!d.exceededTransferLimit };
}
const J = (s, o, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...h } });

export default async (req) => {
  const u = new URL(req.url);
  const bb = (u.searchParams.get('bbox') || '').split(',').map(Number), z = Number(u.searchParams.get('z'));
  if (bb.length !== 4 || bb.some((n) => !Number.isFinite(n)) || !(z >= 8 && z <= 18)) return J(400, { error: 'bad_request' });
  const w = clamp(bb[0], -119, -86), s = clamp(bb[1], 14, 33), e = clamp(bb[2], -119, -86), n = clamp(bb[3], 14, 33);
  if (e <= w || n <= s || (e - w) * (n - s) > 40) return J(400, { error: 'area' });
  const q = new URLSearchParams({
    f: 'json', where: '1=1', geometry: `${w},${s},${e},${n}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true',
    maxAllowableOffset: String((360 / (256 * 2 ** z)) * 2), geometryPrecision: '5', resultRecordCount: '400',
  });
  try {
    const r = await fetch(`${LAYER}/query?${q}`, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
    if (!r.ok) return J(502, { error: 'upstream', status: r.status });
    const d = await r.json();
    if (d.error) return J(502, { error: 'upstream', detail: String(d.error.message || d.error.code || '').slice(0, 160) });
    return J(200, esriToGeoJSON(d), { 'cache-control': 'public, max-age=600, s-maxage=3600' });
  } catch (err) {
    console.error('conagua', err.message, err.cause && (err.cause.code || err.cause.message));
    return J(502, { error: 'upstream', cause: String((err.cause && err.cause.code) || err.name || 'fetch').slice(0, 60) });
  }
};
export const config = { path: '/api/conagua' };
