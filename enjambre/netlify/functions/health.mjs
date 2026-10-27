// Diagnóstico rápido del despliegue: abre https://TU-SITIO/api/health en el navegador.
// Solo devuelve verdadero/falso y códigos de estado; nunca valores de claves. Puedes borrar este archivo cuando termines de configurar.
import { LAYER, fetchCon } from './conagua.mjs';
const J = (o) => new Response(JSON.stringify(o, null, 2), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const intenta = async (fn) => { try { return await fn(); } catch (e) { return { ok: false, error: String((e.cause && e.cause.code) || e.message).slice(0, 80) }; } };
export default async () => {
  const E = process.env, vars = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'RATE_LIMIT_SALT', 'RESEND_API_KEY', 'NOTIFY_EMAIL_FROM', 'ALLOWED_ORIGIN', 'CONAGUA_CA_PEM']) vars[k] = !!E[k];
  const base = (E.SUPABASE_URL || '').replace(/\/$/, ''), key = E.SUPABASE_SECRET_KEY;
  const db = await intenta(async () => {
    if (!base || !key) return { ok: false, error: 'faltan SUPABASE_URL o SUPABASE_SECRET_KEY' };
    const h = { apikey: key, accept: 'application/openapi+json' }; if (key.startsWith('eyJ')) h.authorization = 'Bearer ' + key;
    const r = await fetch(base + '/rest/v1/', { headers: h, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, status: r.status, error: r.status === 401 || r.status === 403 ? 'clave rechazada' : 'respuesta inesperada' };
    const spec = await r.json().catch(() => ({})), paths = Object.keys(spec.paths || {});
    return { ok: paths.includes('/rpc/create_contact_submission'), tabla_contacts: paths.includes('/contacts'), funcion_alta: paths.includes('/rpc/create_contact_submission'), pista: paths.length ? undefined : 'Ejecuta supabase/schema.sql' };
  });
  const conagua = await intenta(async () => {
    const r = await fetchCon(LAYER + '?f=json', { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { ok: false, status: r.status };
    const m = await r.json();
    if (m.error) return { ok: false, error: String(m.error.message || '').slice(0, 100) };
    return { ok: true, nombre: m.name, tipo_geometria: m.geometryType, max_registros: m.maxRecordCount, campos: (m.fields || []).map((f) => f.name).slice(0, 25) };
  });
  return J({ funciones_desplegadas: true, variables_definidas: vars, supabase: db, conagua });
};
export const config = { path: '/api/health' };
