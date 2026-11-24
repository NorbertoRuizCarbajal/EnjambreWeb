// Mapa público de cuerpos de agua: atribución de la fuente y comportamiento cuando el servicio externo falla.
// /api/conagua se simula: estas pruebas verifican el navegador, no la disponibilidad del servidor de SEMARNAT.
import { test, expect, json, CAPA_CON_DATOS } from './apoyo.mjs';

async function abrirMapaYBuscar(page) {
  await page.goto('/');
  await page.locator('#mapa').scrollIntoViewIfNeeded();             // el mapa se inicia al acercarse a la sección
  await expect(page.locator('#mapa-pub .leaflet-container, #mapa-pub.leaflet-container')).toBeVisible();
  await expect(page.locator('#mapa-aviso')).toContainText('Acerca el mapa');   // a zoom nacional no se pide la capa
  await page.locator('#mapa-q').fill('Xochimilco');
  await page.locator('#mapa-bus button[type=submit]').click();     // la búsqueda (simulada) acerca el mapa a zoom 11
}

test('con datos: dibuja la capa y atribuye la fuente que informa el servidor', async ({ page, erroresJS }) => {
  await page.route('**/api/conagua?**', json(200, CAPA_CON_DATOS));
  await abrirMapaYBuscar(page);
  await expect(page.locator('#ley-of')).toBeVisible();
  await expect(page.locator('#ley-fuente')).toHaveText('SEMARNAT');
  await expect(page.locator('#mapa-aviso')).toHaveText('');
  // La ventana de cada cuerpo de agua repite la fuente.
  await page.locator('#mapa-pub path.leaflet-interactive').first().click({ force: true });
  await expect(page.locator('#mapa-pub .leaflet-popup-content')).toContainText('Cuerpo de agua de prueba');
  await expect(page.locator('#mapa-pub .leaflet-popup-content')).toContainText('Fuente: SEMARNAT');
  expect(erroresJS).toEqual([]);
});

test('la atribución sigue a la fuente real si cambia el servicio', async ({ page }) => {
  await page.route('**/api/conagua?**', json(200, { ...CAPA_CON_DATOS, fuente: 'CONAGUA' }));
  await abrirMapaYBuscar(page);
  await expect(page.locator('#ley-fuente')).toHaveText('CONAGUA');
});

test('servicio caído: avisa el motivo, ofrece reintentar y no muestra «Referencia oficial»', async ({ page, erroresJS }) => {
  await page.route('**/api/conagua?**', json(502, { error: 'upstream', fuente: 'SEMARNAT', cause: 'ETIMEDOUT' }));
  await abrirMapaYBuscar(page);
  const aviso = page.locator('#mapa-aviso');
  await expect(aviso).toContainText('No se pudo cargar la capa de referencia');
  await expect(aviso).toContainText('el mapa base sigue disponible');
  await expect(page.locator('#ley-of')).toBeHidden();
  // Reintentar vuelve a consultar; si el servicio ya responde, la capa aparece.
  await page.route('**/api/conagua?**', json(200, CAPA_CON_DATOS));
  await aviso.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('#ley-of')).toBeVisible();
  expect(erroresJS).toEqual([]);
});

test('sin datos en la vista: lo dice en lugar de inventar resultados', async ({ page }) => {
  await abrirMapaYBuscar(page);                                     // la ruta por defecto responde sin cuerpos de agua
  await expect(page.locator('#mapa-aviso')).toContainText('No hay cuerpos de agua de referencia en esta vista');
  await expect(page.locator('#ley-of')).toBeHidden();
});
