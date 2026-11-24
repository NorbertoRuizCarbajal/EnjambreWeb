// Página principal: carga, videos, carrusel de impacto y adaptación a móvil.
import { test, expect } from './apoyo.mjs';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('carga sin errores de JavaScript', async ({ page, erroresJS }) => {
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));   // fuerza la carga diferida de todas las secciones
  await page.waitForTimeout(500);
  expect(erroresJS).toEqual([]);
});

test.describe('videos', () => {
  // Regresión: landing.js asignaba src = data-src a TODOS los videos. Los de «Evidencia del desarrollo» usan <source> y no
  // tienen data-src, así que su src pasaba a ser "undefined" y dejaban de reproducirse.
  for (const archivo of ['prueba-barco-2023', 'prototipo-barco-2024']) {
    test(`el video de evidencia ${archivo} conserva su fuente al verse en pantalla`, async ({ page }) => {
      const v = page.locator(`video[poster*="${archivo}"]`);
      await v.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);   // margen para el IntersectionObserver
      const estado = await v.evaluate((x) => ({ src: x.getAttribute('src'), fuentes: [...x.querySelectorAll('source')].map((s) => s.getAttribute('src')), error: x.error && x.error.code }));
      expect(estado.src, 'no debe recibir un src asignado por el script').toBeNull();
      expect(estado.fuentes[0]).toContain(`${archivo}.mp4`);
      expect(estado.error).toBeNull();
    });
  }

  test('«Pausar/Reanudar movimiento» no asigna fuente a los videos de evidencia', async ({ page }) => {
    const pz = page.locator('#pz');
    await pz.click(); await pz.click();                            // pausar y reanudar
    const v = page.locator('video[poster*="prueba-barco-2023"]');
    await v.scrollIntoViewIfNeeded();
    expect(await v.getAttribute('src')).toBeNull();
  });

  test('los videos de las etapas se cargan solo al acercarse a la pantalla', async ({ page }) => {
    const v = page.locator('video[data-src$="05-direccion.mp4"]');
    expect(await v.getAttribute('src')).toBeNull();               // carga diferida: nada antes de verlo
    await v.scrollIntoViewIfNeeded();
    await expect(v).toHaveAttribute('src', /05-direccion\.mp4$/);
  });
});

test.describe('carrusel de impacto', () => {
  test('navega con las flechas y deshabilita la que no aplica', async ({ page }) => {
    const car = page.locator('#ia-car');
    await car.scrollIntoViewIfNeeded();
    await expect(car).toBeVisible();
    const cont = page.locator('#ia-cont'), prev = page.locator('#ia-prev'), next = page.locator('#ia-next');
    await expect(cont).toHaveText('Noticia 1 de 3');
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(cont).toHaveText('Noticia 2 de 3');
    await expect(prev).toBeEnabled();
    await next.click();
    await expect(cont).toHaveText('Noticia 3 de 3');
    await expect(next).toBeDisabled();
    await expect(prev).toBeFocused();                              // el foco no se pierde al deshabilitarse la flecha
    await page.keyboard.press('ArrowLeft');
    await expect(cont).toHaveText('Noticia 2 de 3');
  });

  test('cada noticia indica su fuente y enlaza a la publicación original', async ({ page }) => {
    const activa = page.locator('#ia-track > .ia-c:not([aria-hidden="true"])');
    await page.locator('#ia-car').scrollIntoViewIfNeeded();
    await expect(activa.locator('.ia-k')).toContainText('Atribución de la autoridad');
    await expect(activa.locator('.ia-f')).not.toBeEmpty();
    await expect(activa.locator('a.ia-l')).toHaveAttribute('href', /^https:\/\//);
    await expect(activa.locator('a.ia-l')).toHaveAttribute('rel', /noopener/);
  });
});

test('no hay desplazamiento horizontal', async ({ page }) => {
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(0);
});

test('menú en móvil: abre, cierra y actualiza aria-expanded', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el botón de menú solo se muestra en móvil');
  const boton = page.locator('#bm'), menu = page.locator('#mn');
  await expect(boton).toBeVisible();
  await boton.click();
  await expect(boton).toHaveAttribute('aria-expanded', 'true');
  await menu.getByRole('link', { name: 'Sistema real' }).click();
  await expect(boton).toHaveAttribute('aria-expanded', 'false');
});
