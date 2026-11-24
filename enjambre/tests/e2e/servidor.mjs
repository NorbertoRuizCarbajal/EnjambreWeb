// Servidor estático mínimo para las pruebas de navegador (sin dependencias).
// Sirve public/ tal como lo publica Netlify. Las rutas /api/* NO existen aquí: cada prueba las simula con page.route(),
// así las pruebas no necesitan Netlify, Supabase ni servicios externos, y nunca tocan datos reales.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../public/', import.meta.url));
const PUERTO = Number(process.env.PUERTO_PRUEBAS || 4173);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

async function resolver(urlPath) {
  const ruta = normalize(join(RAIZ, decodeURIComponent(urlPath.split('?')[0])));
  if (!ruta.startsWith(RAIZ.replace(/[\\/]$/, '') + sep) && ruta !== RAIZ.replace(/[\\/]$/, '')) return null;   // sin salir de public/
  try {
    const s = await stat(ruta);
    return s.isDirectory() ? join(ruta, 'index.html') : ruta;
  } catch { return null; }
}

createServer(async (req, res) => {
  const archivo = await resolver(req.url);
  if (!archivo) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('No encontrado'); return; }
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(datos);
  } catch { res.writeHead(404); res.end(); }
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sitio de pruebas en http://127.0.0.1:${PUERTO}`));
