import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleOpenAIProxy } from '../../lib/openai/openai-dev-proxy';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function resolveDefaultWebRoot() {
  const packageWebRoot = new URL('../../../dist/web', import.meta.url);
  if (packageWebRoot.protocol === 'file:') {
    return fileURLToPath(packageWebRoot);
  }

  return resolve(process.cwd(), 'dist/web');
}

export interface TokenCanvasWebServerOptions {
  rootDir?: string;
  host?: string;
  port?: number;
  enableProxy?: boolean;
}

export interface TokenCanvasWebServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

function sendText(response: ServerResponse, statusCode: number, body: string, contentType = 'text/plain; charset=utf-8') {
  response.statusCode = statusCode;
  response.setHeader('content-type', contentType);
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  sendText(response, statusCode, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function parseRequestPath(request: IncomingMessage) {
  try {
    return {
      ok: true as const,
      pathname: new URL(request.url ?? '/', `http://${request.headers.host ?? 'tokencanvas.local'}`).pathname,
    };
  } catch {
    return {
      ok: false as const,
      response: {
        error: 'invalid_request_url',
        detail: 'Request URL or Host header is invalid.',
      },
    };
  }
}

function isPathInsideRoot(rootDir: string, candidatePath: string) {
  const relativePath = relative(rootDir, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`));
}

async function resolveStaticFile(rootDir: string, requestUrl: string) {
  let decodedPath = '/';
  try {
    const url = new URL(requestUrl, 'http://tokencanvas.local');
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return { status: 400 as const, path: '' };
  }
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = resolve(rootDir, `.${normalizedPath}`);

  if (!isPathInsideRoot(rootDir, requestedPath)) {
    return { status: 403 as const, path: '' };
  }

  try {
    const fileStat = await stat(requestedPath);
    if (fileStat.isFile()) {
      return { status: 200 as const, path: requestedPath };
    }
  } catch {
    // SPA fallback happens below.
  }

  return { status: 200 as const, path: join(rootDir, 'index.html') };
}

async function serveStatic(rootDir: string, request: IncomingMessage, response: ServerResponse) {
  if (!request.url) {
    sendText(response, 400, 'Missing request URL');
    return;
  }

  const resolvedFile = await resolveStaticFile(rootDir, request.url);
  if (resolvedFile.status === 400) {
    sendText(response, 400, 'Invalid request URL');
    return;
  }

  if (resolvedFile.status === 403) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const body = await readFile(resolvedFile.path);
    response.statusCode = 200;
    response.setHeader('content-type', MIME_TYPES[extname(resolvedFile.path)] ?? 'application/octet-stream');
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    sendText(
      response,
      500,
      `TokenCanvas Web UI assets are missing. Run package build before starting web mode. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function assertWebAssets(rootDir: string) {
  await access(join(rootDir, 'index.html'), constants.R_OK);
}

export async function startTokenCanvasWebServer(
  options: TokenCanvasWebServerOptions = {},
): Promise<TokenCanvasWebServer> {
  const rootDir = resolve(options.rootDir ?? resolveDefaultWebRoot());
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 4174;
  const enableProxy = options.enableProxy ?? false;

  await assertWebAssets(rootDir);

  const server = createServer((request, response) => {
    const parsedPath = parseRequestPath(request);
    if (!parsedPath.ok) {
      sendJson(response, 400, parsedPath.response);
      return;
    }

    if (parsedPath.pathname.startsWith('/api/openai/')) {
      if (!enableProxy) {
        sendJson(response, 404, {
          error: 'local_openai_proxy_disabled',
          detail: 'Local OpenAI proxy is disabled. Start with --proxy to enable /api/openai routes.',
        });
        return;
      }

      void handleOpenAIProxy(request, response).catch((error) => {
        sendJson(response, 502, {
          error: 'local_openai_proxy_failed',
          detail: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }

    void serveStatic(rootDir, request, response).catch((error) => {
      sendText(response, 500, error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  const address = server.address() as AddressInfo | null;
  const assignedPort = address?.port ?? port;

  return {
    server,
    url: `http://${host}:${assignedPort}`,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }

        resolveClose();
      });
    }),
  };
}
