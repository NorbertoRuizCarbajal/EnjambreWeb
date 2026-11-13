// Comprobación de catálogos (se ejecuta en el build y con `npm run check`).
// Las listas de países, tipos de interés y estados existen en varios archivos porque cada uno se ejecuta en un lugar distinto
// (navegador, función de Netlify, base de datos). Este script falla si alguna copia deja de coincidir con las demás,
// para que un cambio en un solo archivo no rompa el formulario o el panel en producción.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(raiz, p), 'utf8');
const errores = [];

function extraer(archivo, re, como, descripcion) {
  const m = leer(archivo).match(re);
  if (!m) { errores.push(`No se encontró ${descripcion} en ${archivo} (¿cambió el formato?)`); return null; }
  return { archivo, valores: como(m[1]) };
}
const palabras = (s) => s.trim().split(/\s+/);
const comillas = (s) => [...s.matchAll(/'([^']+)'/g)].map((x) => x[1]);
const claves = (s) => [...s.matchAll(/(\w+)\s*:\s*'/g)].map((x) => x[1]);
const opciones = (s) => [...s.matchAll(/<option>([^<]+)<\/option>/g)].map((x) => x[1]);

function iguales(nombre, ...copias) {
  const validas = copias.filter(Boolean);
  if (validas.length < 2) return;
  const [ref, ...resto] = validas, clave = (v) => JSON.stringify([...v].sort());
  for (const c of resto) {
    if (clave(c.valores) === clave(ref.valores)) continue;
    const falta = ref.valores.filter((v) => !c.valores.includes(v)), sobra = c.valores.filter((v) => !ref.valores.includes(v));
    errores.push(`${nombre}: ${c.archivo} no coincide con ${ref.archivo}` + (falta.length ? ` · faltan: ${falta.join(', ')}` : '') + (sobra.length ? ` · sobran: ${sobra.join(', ')}` : ''));
  }
}

iguales('Países (ISO 3166-1)',
  extraer('netlify/functions/submit-contact.mjs', /const PAISES = new Set\('([^']+)'/, palabras, 'la lista PAISES'),
  extraer('public/js/mapa.js', /const ISO = '([^']+)'/, palabras, 'la lista ISO'));

iguales('Tipos de interés',
  extraer('netlify/functions/submit-contact.mjs', /const INTERESES = \[([^\]]+)\]/, comillas, 'INTERESES'),
  extraer('public/admin/admin.js', /const INTERESES = \[([^\]]+)\]/, comillas, 'INTERESES'),
  extraer('public/index.html', /<select name="interes"[^>]*>([\s\S]*?)<\/select>/, opciones, 'el selector de interés'));

iguales('Estados comerciales',
  extraer('supabase/schema.sql', /status text not null default 'nuevo' check \(status in([\s\S]*?)\)\)/, comillas, 'el check de contacts.status'),
  extraer('public/admin/admin.js', /const ESTADOS = \{([^}]+)\}/, claves, 'ESTADOS'),
  extraer('public/admin/admin.js', /const COLOR = \{([^}]+)\}/, claves, 'COLOR'));

iguales('Estados de evaluación del sitio',
  extraer('supabase/schema.sql', /status text not null default 'sin_evaluar' check \(status in([\s\S]*?)\)\)/, comillas, 'el check de waterbody_assessments.status'),
  extraer('public/admin/admin.js', /const SITIO = \{([^}]+)\}/, claves, 'SITIO'));

iguales('Roles del equipo',
  extraer('supabase/schema.sql', /role text not null check \(role in \(([^)]+)\)\)/, comillas, 'el check de staff_members.role'),
  extraer('public/admin/admin.js', /const ROLES = \{([^}]+)\}/, claves, 'ROLES'));

if (errores.length) { console.error('ERROR: catálogos desincronizados:\n  ' + errores.join('\n  ')); process.exit(1); }
console.log('Comprobación de catálogos OK: países, intereses, estados y roles coinciden en todos los archivos.');
