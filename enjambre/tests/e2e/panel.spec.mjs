// Panel privado (/admin/). Aquí solo se prueba el comportamiento del navegador con Supabase simulado.
// La seguridad real son las políticas RLS de Supabase: esas se prueban con cuentas reales (docs/PRUEBAS.md, sección 4).
import { test, expect, json } from './apoyo.mjs';

const SUPA = 'https://proyecto-prueba.supabase.co';
const configPublica = (cfg) => (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: `window.ENJAMBRE_CFG=${JSON.stringify(cfg)};` });

test('sin configuración pública: lo explica y no intenta conectarse', async ({ page }) => {
  let peticiones = 0;
  await page.route('https://*.supabase.co/**', (r) => { peticiones++; return r.abort(); });
  await page.route('**/api/public-config.js', configPublica({}));
  await page.goto('/admin/');
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#le')).toContainText('Falta configurar SUPABASE_URL');
  await expect(page.locator('#app')).toBeHidden();
  expect(peticiones).toBe(0);
});

test.describe('con Supabase simulado', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/public-config.js', configPublica({ supabaseUrl: SUPA, supabaseKey: 'sb_publishable_prueba' }));
  });

  test('sin sesión muestra el acceso y oculta el panel', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
  });

  test('credenciales rechazadas: mensaje genérico y el panel sigue oculto', async ({ page }) => {
    await page.route(`${SUPA}/auth/v1/token**`, json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }));
    await page.goto('/admin/');
    await page.locator('#lm').fill('alguien@example.com');
    await page.locator('#lp').fill('contraseña-incorrecta');
    await page.locator('#lg').click();
    await expect(page.locator('#le')).toHaveText('Correo o contraseña incorrectos.');
    await expect(page.locator('#app')).toBeHidden();
  });
});

test('el panel no se indexa en buscadores', async ({ page }) => {
  await page.route('**/api/public-config.js', configPublica({}));
  await page.goto('/admin/');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});
