import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  outputDir: './node_modules/.cache/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../backend/scripts/start-isolated-test.js',
      url: 'http://127.0.0.1:5017/api/docs/',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5176 --strictPort',
      url: 'http://127.0.0.1:5176',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        VITE_MAIN_URL: 'http://127.0.0.1:5017',
      },
    },
  ],
});
