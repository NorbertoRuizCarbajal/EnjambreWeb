// Pruebas de navegador (Playwright). Ejecutar desde enjambre/:  npm run test:e2e
// Vive dentro de tests/ para que un cambio aquí no dispare un deploy de Netlify (ver la regla "ignore" de netlify.toml).
import { defineConfig, devices } from '@playwright/test';

const PUERTO = Number(process.env.PUERTO_PRUEBAS || 4173);
// Opcional: usar un Chrome ya instalado en lugar del que descarga `npx playwright install` (ruta al ejecutable).
const chrome = process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME } } : {};

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  outputDir: './resultados',
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: './reporte', open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-MX',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...chrome,
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, ...chrome } },
    { name: 'movil', use: { ...devices['Pixel 7'], ...chrome } },
  ],
  webServer: {
    command: 'node servidor.mjs',   // se ejecuta en esta misma carpeta (tests/e2e/)
    url: `http://127.0.0.1:${PUERTO}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
