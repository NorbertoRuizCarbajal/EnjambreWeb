// Apoyos comunes de las pruebas de navegador.
// Regla: ninguna prueba sale a internet. Los servicios externos (teselas y búsqueda de OpenStreetMap, Supabase) y las
// funciones /api/* se simulan con respuestas fijas. Así las pruebas son reproducibles y nunca crean registros reales.
import { test as base, expect } from '@playwright/test';

// PNG transparente de 1×1 para las teselas del mapa base.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// Un lugar de ejemplo para la búsqueda (Xochimilco, CDMX) y un cuerpo de agua alrededor de él.
export const LUGAR = { lat: 19.27, lon: -99.1 };
export const CAPA_CON_DATOS = {
  type: 'FeatureCollection', fuente: 'SEMARNAT', exceededTransferLimit: false,
  features: [{
    type: 'Feature', properties: { NOMBRE: 'Cuerpo de agua de prueba' },
    geometry: { type: 'Polygon', coordinates: [[[-99.13, 19.25], [-99.07, 19.25], [-99.07, 19.29], [-99.13, 19.29], [-99.13, 19.25]]] },
  }],
};

export const test = base.extend({
  // Errores de JavaScript no capturados durante la prueba (deben quedar en cero).
  erroresJS: async ({ page }, usar) => {
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await usar(errores);
  },
  page: async ({ page }, usar) => {
    // 1) Todo lo externo se bloquea por defecto (las rutas registradas después tienen prioridad).
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort('blockedbyclient'));
    // 2) Mapa base: teselas vacías.
    await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    // 3) Búsqueda de lugares: siempre responde el lugar de ejemplo.
    await page.route('https://nominatim.openstreetmap.org/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ lat: String(LUGAR.lat), lon: String(LUGAR.lon), boundingbox: ['14.5', '32.8', '-118.5', '-86.5'] }]),
    }));
    // 4) Capa de cuerpos de agua: vacía salvo que la prueba indique otra cosa.
    await page.route('**/api/conagua?**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [], fuente: 'SEMARNAT' }),
    }));
    await usar(page);
  },
});
export { expect };

// Responde una ruta con JSON.
export const json = (status, cuerpo) => (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
