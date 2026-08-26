import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_TEST_PORT ?? '43173';
const baseURL = `http://127.0.0.1:${port}`;
const useOpenAIDevProxy = process.env.PLAYWRIGHT_USE_OPENAI_DEV_PROXY === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: useOpenAIDevProxy
      ? `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`
      : `pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
