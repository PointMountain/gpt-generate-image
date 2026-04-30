import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

function filterForwardHeaders(headers: IncomingHttpHeaders) {
  const forwardedHeaders = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    const lowered = key.toLowerCase();
    if (
      [
        'host',
        'content-length',
        'connection',
        'origin',
        'referer',
        'sec-fetch-mode',
        'sec-fetch-site',
        'sec-fetch-dest',
      ].includes(lowered)
    ) {
      return;
    }

    forwardedHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
  });

  return forwardedHeaders;
}

async function readRequestBody(request: IncomingMessage) {
  if (!request.method || ['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function handleLocalProxy(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
  const target = requestUrl.searchParams.get('target');

  if (!target || !/^https?:\/\//i.test(target)) {
    response.statusCode = 400;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'missing_or_invalid_target' }));
    return;
  }

  try {
    const body = await readRequestBody(request);
    const upstream = await fetch(target, {
      method: request.method,
      headers: filterForwardHeaders(request.headers),
      body,
      redirect: 'manual',
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (['content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        return;
      }

      response.setHeader(key, value);
    });
    response.setHeader('x-local-proxy-target', target);

    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.end(buffer);
  } catch (error) {
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(
      JSON.stringify({
        error: 'proxy_request_failed',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-provider-proxy',
      configureServer(server) {
        server.middlewares.use('/__proxy', (request, response, next) => {
          void handleLocalProxy(request, response).catch(next);
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
