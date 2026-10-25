// Entrega al navegador (panel /admin) SOLO la configuración pública: URL del proyecto + clave PUBLICABLE.
// Se genera en TIEMPO DE EJECUCIÓN, no durante el build: así ningún valor de variable queda escrito en archivos del sitio
// y el escaneo de secretos de Netlify (que revisa repo y salida del build) no tiene nada que marcar, sin exclusiones.
const resp = (cfg) => new Response(`window.ENJAMBRE_CFG=${JSON.stringify(cfg)};\n`, {
  status: 200,
  headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
});
// Defensa: si por error se pegó una clave SECRETA en la variable publicable, nunca se envía al navegador.
function esSecreta(k) {
  if (/^sb_secret_/.test(k)) return true;
  if (k.startsWith('eyJ')) { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch { return false; } }
  return false;
}
export default async () => {
  const url = (process.env.SUPABASE_URL || '').trim(), key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  let https = false; try { https = new URL(url).protocol === 'https:'; } catch { /* URL inválida */ }
  if (!https || !key) { console.warn('public-config: faltan SUPABASE_URL (https) o SUPABASE_PUBLISHABLE_KEY'); return resp({}); }
  if (esSecreta(key)) { console.error('public-config: SUPABASE_PUBLISHABLE_KEY contiene una clave secreta; se rechaza y no se envía'); return resp({}); }
  return resp({ supabaseUrl: url.replace(/\/$/, ''), supabaseKey: key });
};
export const config = { path: '/api/public-config.js' };
