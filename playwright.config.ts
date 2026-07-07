import { defineConfig, devices } from '@playwright/test';

const appBase = process.env.E2E_APP_BASE_URL ?? 'http://localhost:3000';
const cpBase = process.env.E2E_CP_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'demo-chromium',
      testMatch: /demo-happy-path\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: appBase },
    },
    {
      name: 'app-ess-chromium',
      testMatch: /app-ess-happy-path\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: appBase },
    },
    {
      name: 'control-plane-chromium',
      testMatch: /control-plane-happy-path\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: cpBase },
    },
  ],
});
