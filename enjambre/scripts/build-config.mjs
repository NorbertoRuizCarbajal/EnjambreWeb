// Netlify ejecuta esto en el build: genera public/admin/config.js con valores PÚBLICOS (URL + Publishable key).
import { writeFileSync } from 'node:fs';
const url = process.env.SUPABASE_URL || '', key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (!url || !key) console.warn('AVISO: faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY; el panel /admin no podrá iniciar sesión.');
writeFileSync('public/admin/config.js', `window.ENJAMBRE_CFG=${JSON.stringify({ supabaseUrl: url, supabaseKey: key })};\n`);
