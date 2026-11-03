import { defineConfig, devices } from '@playwright/test';

// Port über PORT änderbar (z. B. wenn 4174 belegt ist): PORT=4191 npx playwright test
const PORT = Number(process.env.PORT || 4174);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure' },
  // Der Server baut immer frisch (kein veralteter dist/-Stand); die Komponenten-Testseite kommt aus
  // e2e/harness/ nach dist-harness/ und wird nicht mit dem Rechner ausgeliefert.
  webServer: {
    command: 'npm run build && vite build --config e2e/harness/vite.config.ts && node e2e/serve.mjs',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PORT: String(PORT) },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
});
