// Recibe el formulario público. Valida en servidor, guarda PRIMERO en Supabase (RPC con Secret key) y
// DESPUÉS intenta la notificación por correo (si falla el correo, el registro ya existe y se responde ok).
import { createHash } from 'node:crypto';

const ESTADOS = ['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];
const INTERESES = ['Inversión','Alianza estratégica','Gobierno o institución pública','Empresa con enfoque sostenible','Apoyo técnico','Investigación o universidad','Medios / prensa','Otro'];
const J = (s, o) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clean = (v, n, multi = false) => typeof v === 'string'
  ? v.replace(multi ? /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '';

export default async (req) => {
  if (req.method !== 'POST') return J(405, { error: 'method' });
  const allow = process.env.ALLOWED_ORIGIN, origin = req.headers.get('origin');
  if (allow && origin && origin !== allow) return J(403, { error: 'origin' });

  const raw = await req.text();
  if (raw.length > 20000) return J(413, { error: 'size' });
  let b; try { b = JSON.parse(raw); } catch { return J(400, { error: 'json' }); }
  if (!b || typeof b !== 'object') return J(400, { error: 'json' });
  if (clean(b._honey, 50)) return J(200, { ok: true });          // honeypot: bots reciben "ok" y no se guarda nada

  const d = {
    nombre: clean(b.nombre, 120), organizacion: clean(b.organizacion, 160), correo: clean(b.correo, 160).toLowerCase(),
    telefono: clean(b.telefono, 40), interes: clean(b.interes, 60), mensaje: clean(b.mensaje, 3000, true),
    cuerpo_agua: clean(b.cuerpo_agua, 120), municipio: clean(b.municipio, 80), estado: clean(b.estado, 40),
  };
  const bad = [];
  if (!d.nombre) bad.push('nombre');
  if (!d.organizacion) bad.push('organizacion');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) bad.push('correo');
  if (!INTERESES.includes(d.interes)) bad.push('interes');
  if (!d.mensaje) bad.push('mensaje');
  if (d.estado && !ESTADOS.includes(d.estado)) bad.push('estado');

  // Ubicación opcional y SIEMPRE aproximada: se redondea a 2 decimales (~1 km) en el servidor.
  const hasPin = b.lat !== undefined && b.lat !== null && b.lat !== '' || b.lng !== undefined && b.lng !== null && b.lng !== '';
  if (hasPin) {
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 14 || lat > 33 || lng < -119 || lng > -86) bad.push('ubicacion');
    else if (b.consentimiento_ubicacion !== true) bad.push('consentimiento_ubicacion');
    else { d.lat = Math.round(lat * 100) / 100; d.lng = Math.round(lng * 100) / 100; d.consentimiento_ubicacion = true; }
  }
  if (bad.length) return J(400, { error: 'validation', campos: bad });

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY'); return J(500, { error: 'config' }); }
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocida';
  const ipHash = createHash('sha256').update((process.env.RATE_LIMIT_SALT || '') + ip).digest('hex');

  const headers = { 'content-type': 'application/json', apikey: key };
  if (key.startsWith('eyJ')) headers.authorization = 'Bearer ' + key;   // claves legacy (JWT); las sb_secret_ no lo necesitan
  let r;
  try {
    r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/create_contact_submission`, {
      method: 'POST', headers, body: JSON.stringify({ p: d, p_ip_hash: ipHash }), signal: AbortSignal.timeout(10000),
    });
  } catch (e) { console.error('db', e.message); return J(502, { error: 'db' }); }
  if (!r.ok) {
    const t = await r.text();
    if (t.includes('rate_limited')) return J(429, { error: 'rate_limited' });
    console.error('db', r.status, t.slice(0, 300));
    return J(502, { error: 'db' });                                    // sin registro → la landing NO muestra éxito
  }

  // Notificación por correo (adicional). Requiere RESEND_API_KEY; si no existe o falla, el registro ya está guardado.
  if (process.env.RESEND_API_KEY) {
    try {
      const to = process.env.NOTIFY_EMAIL_TO || 'proyectoenjambre.contacto@gmail.com';
      const text = [`Nuevo contacto desde la landing de Enjambre`, '', `Nombre: ${d.nombre}`, `Organización: ${d.organizacion}`,
        `Correo: ${d.correo}`, `Teléfono: ${d.telefono || '—'}`, `Interés: ${d.interes}`,
        `Sitio: ${[d.cuerpo_agua, d.municipio, d.estado].filter(Boolean).join(', ') || '—'}`, '', d.mensaje,
        '', 'Gestiona este contacto en el panel privado (/admin).'].join('\n');
      const e = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ from: process.env.NOTIFY_EMAIL_FROM, to: [to], reply_to: d.correo, subject: 'Nuevo contacto — Enjambre', text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!e.ok) console.error('email', e.status, (await e.text()).slice(0, 200));
    } catch (e) { console.error('email', e.message); }
  }
  return J(200, { ok: true });
};
export const config = { path: '/api/contact' };
