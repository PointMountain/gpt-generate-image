import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:43173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port 43173 --strictPort',
    url: 'http://127.0.0.1:43173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
