// Formulario de colaboración (/colabora/). /api/contact se simula: se verifica qué envía el navegador y cómo
// responde la interfaz. La validación del servidor está cubierta en tests/funciones.test.mjs (npm test).
import { test, expect, json } from './apoyo.mjs';

const DATOS = { nombre: 'Ana Prueba', organizacion: 'Organización de prueba', correo: 'ana@example.com', mensaje: 'Mensaje de prueba.' };

async function llenar(page) {
  await page.locator('[name=nombre]').fill(DATOS.nombre);
  await page.locator('[name=organizacion]').fill(DATOS.organizacion);
  await page.locator('[name=correo]').fill(DATOS.correo);
  await page.locator('[name=interes]').selectOption('Apoyo técnico');
  await page.locator('[name=mensaje]').fill(DATOS.mensaje);
}
const enviar = (page) => page.locator('#fm .envio button[type=submit]').click();

// Registra los envíos a /api/contact y responde lo indicado.
async function simularEnvio(page, status, cuerpo) {
  const envios = [];
  await page.route('**/api/contact', (r) => { envios.push(r.request().postDataJSON()); return json(status, cuerpo)(r); });
  return envios;
}

test.beforeEach(async ({ page }) => { await page.goto('/colabora/'); });

test('campos obligatorios vacíos: no envía nada y lo indica', async ({ page }) => {
  const envios = await simularEnvio(page, 200, { ok: true });
  await enviar(page);
  await expect(page.locator('#st')).toHaveText('Revisa los campos marcados e inténtalo de nuevo.');
  expect(envios).toHaveLength(0);
});

test('correo inválido: no envía', async ({ page }) => {
  const envios = await simularEnvio(page, 200, { ok: true });
  await llenar(page);
  await page.locator('[name=correo]').fill('no-es-un-correo');
  await enviar(page);
  await expect(page.locator('#st')).toContainText('Revisa los campos');
  expect(envios).toHaveLength(0);
});

test('envío correcto: manda los datos sin ubicación, confirma y limpia el formulario', async ({ page, erroresJS }) => {
  const envios = await simularEnvio(page, 200, { ok: true });
  await llenar(page);
  await enviar(page);
  await expect(page.locator('#st')).toContainText('Gracias por contactar a Enjambre');
  expect(envios).toHaveLength(1);
  expect(envios[0]).toMatchObject({ ...DATOS, interes: 'Apoyo técnico', pais: 'MX', consentimiento_ubicacion: false });
  expect(envios[0]).not.toHaveProperty('lat');
  expect(envios[0]).not.toHaveProperty('lng');
  await expect(page.locator('[name=nombre]')).toHaveValue('');
  expect(erroresJS).toEqual([]);
});

test('el servidor no guarda el registro: no muestra éxito y conserva los datos', async ({ page }) => {
  await simularEnvio(page, 500, { error: 'config' });
  await llenar(page);
  await enviar(page);
  await expect(page.locator('#st')).toContainText('aún no está configurado');
  await expect(page.locator('#st')).not.toContainText('Gracias');
  await expect(page.locator('[name=nombre]')).toHaveValue(DATOS.nombre);
  await expect(page.locator('#fm .envio button[type=submit]')).toHaveText('Reintentar envío');
});

test('demasiados envíos (429): mensaje específico', async ({ page }) => {
  await simularEnvio(page, 429, { error: 'rate_limited' });
  await llenar(page);
  await enviar(page);
  await expect(page.locator('#st')).toContainText('Recibimos varios envíos');
});

test('sin conexión: lo dice y conserva los datos', async ({ page }) => {
  await page.route('**/api/contact', (r) => r.abort('internetdisconnected'));
  await llenar(page);
  await enviar(page);
  await expect(page.locator('#st')).toContainText('No hay conexión con el servidor');
  await expect(page.locator('[name=mensaje]')).toHaveValue(DATOS.mensaje);
});

test.describe('ubicación aproximada (opcional)', () => {
  async function colocarPin(page) {
    await page.locator('#pinbox summary').click();
    const mapa = page.locator('#pmap');
    await expect(mapa.locator('.leaflet-tile-container, .leaflet-pane').first()).toBeAttached();
    await mapa.click();                                              // un toque en el mapa coloca el pin
    await expect(page.locator('#cons')).toBeVisible();
  }

  test('con pin, el consentimiento es obligatorio', async ({ page }) => {
    const envios = await simularEnvio(page, 200, { ok: true });
    await llenar(page);
    await colocarPin(page);
    await enviar(page);
    await expect(page.locator('#st')).toContainText('Revisa los campos');
    expect(envios).toHaveLength(0);
  });

  test('con pin y consentimiento, envía coordenadas aproximadas (2 decimales)', async ({ page }) => {
    const envios = await simularEnvio(page, 200, { ok: true });
    await llenar(page);
    await colocarPin(page);
    await page.locator('#cons input').check();
    await enviar(page);
    await expect(page.locator('#st')).toContainText('Gracias');
    expect(envios).toHaveLength(1);
    expect(envios[0].consentimiento_ubicacion).toBe(true);
    for (const k of ['lat', 'lng']) expect(String(envios[0][k])).toMatch(/^-?\d+\.\d{2}$/);
  });

  test('quitar el pin elimina las coordenadas y el consentimiento', async ({ page }) => {
    const envios = await simularEnvio(page, 200, { ok: true });
    await llenar(page);
    await colocarPin(page);
    await page.locator('#pquit').click();
    await expect(page.locator('#cons')).toBeHidden();
    await enviar(page);
    await expect(page.locator('#st')).toContainText('Gracias');
    expect(envios[0]).not.toHaveProperty('lat');
  });
});

test('enlaza al aviso de privacidad', async ({ page }) => {
  await expect(page.locator('#fm a[href="../privacidad/"]')).toBeVisible();
  await page.locator('#fm a[href="../privacidad/"]').click();
  await expect(page).toHaveURL(/\/privacidad\/$/);
});
