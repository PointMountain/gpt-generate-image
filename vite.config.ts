import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { handleOpenAIProxy } from './src/lib/openai/openai-dev-proxy';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'openai-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/openai', (request, response, next) => {
          void handleOpenAIProxy(request, response).catch(next);
        });
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
