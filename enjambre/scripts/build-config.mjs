// Comprobación previa al despliegue (comando de build). NO genera archivos de configuración ni escribe valores en public/.
// 1) Elimina un config.js heredado de versiones anteriores. 2) Avisa (solo NOMBRES) de variables que faltan.
// 3) Falla el build si el valor de una variable PRIVADA aparece dentro de public/. Nunca imprime valores.
import { readdirSync, readFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const heredado = 'public/admin/config.js';
if (existsSync(heredado)) { rmSync(heredado); console.log('Se eliminó public/admin/config.js heredado (ya no se genera en el build).'); }

const requeridas = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'RATE_LIMIT_SALT'];
const faltan = requeridas.filter((k) => !process.env[k]);
if (faltan.length) console.warn('AVISO: variables sin definir en este build: ' + faltan.join(', ') + ' (las funciones y el panel las leen en ejecución; revisa que tengan alcance Functions).');

const privadas = ['SUPABASE_SECRET_KEY', 'RATE_LIMIT_SALT', 'RESEND_API_KEY', 'CONAGUA_CA_PEM']
  .map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 8).map(([k, v]) => [k, Buffer.from(v)]);
const archivos = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n), s = statSync(p); return s.isDirectory() ? archivos(p) : s.size < 40e6 ? [p] : []; });
const hallazgos = [];
if (existsSync('public')) for (const f of archivos('public')) { const b = readFileSync(f); for (const [k, v] of privadas) if (b.includes(v)) hallazgos.push(`${k} → ${f}`); }
if (hallazgos.length) { console.error('ERROR: valores de variables privadas dentro de public/:\n  ' + hallazgos.join('\n  ')); process.exit(1); }
console.log('Comprobación de configuración OK: ningún valor privado en public/.');
