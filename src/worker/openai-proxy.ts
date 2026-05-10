import { DEFAULT_OPENAI_BASE_URL } from '../lib/openai/openai-endpoint';

const MAX_WORKER_PROXY_REQUEST_BYTES = 40 * 1024 * 1024;
const WORKER_PROXY_TIMEOUT_MS = 190_000;

const ALLOWED_PROXY_ROUTES = [
  { method: 'GET', pathname: '/models' },
  { method: 'POST', pathname: '/images/generations' },
  { method: 'POST', pathname: '/images/edits' },
];

const ALLOWED_REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'content-type',
  'openai-organization',
  'openai-project',
  'user-agent',
]);

const ALLOWED_RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-disposition',
  'content-type',
  'etag',
  'last-modified',
  'retry-after',
  'x-request-id',
]);

export interface WorkerOpenAIProxyEnv {
  OPENAI_API_KEY?: string;
  TOKENCANVAS_PROXY_TOKEN?: string;
}

interface HandleWorkerOpenAIProxyOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function redactSensitiveDetail(detail: string) {
  return detail
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]')
    .replace(/(Authorization\s*[:=]\s*)[^\s,}]+/gi, '$1[redacted]');
}

function readAccessToken(request: Request) {
  const explicitToken = request.headers.get('x-tokencanvas-proxy-token')?.trim();
  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get('authorization')?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function validateProxyAccess(request: Request, env: WorkerOpenAIProxyEnv) {
  if (!env.OPENAI_API_KEY?.trim()) {
    return jsonResponse(500, {
      error: 'missing_openai_api_key',
      detail: 'Cloudflare Worker secret OPENAI_API_KEY is not configured.',
    });
  }

  if (!env.TOKENCANVAS_PROXY_TOKEN?.trim()) {
    return jsonResponse(500, {
      error: 'missing_proxy_access_token',
      detail: 'Cloudflare Worker secret TOKENCANVAS_PROXY_TOKEN is not configured.',
    });
  }

  if (readAccessToken(request) !== env.TOKENCANVAS_PROXY_TOKEN) {
    return jsonResponse(401, {
      error: 'unauthorized_proxy_request',
      detail: 'Valid TokenCanvas proxy access token is required.',
    });
  }

  return null;
}

function resolveOpenAIProxyPath(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api\/openai/, '') || '/';
  const method = request.method.toUpperCase();
  const route = ALLOWED_PROXY_ROUTES.find((candidate) => (
    candidate.method === method &&
    candidate.pathname === pathname
  ));

  if (!route) {
    return null;
  }

  return `${pathname}${url.search}`;
}

function createUpstreamHeaders(request: Request, apiKey: string) {
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const normalized = key.toLowerCase();
    if (ALLOWED_REQUEST_HEADERS.has(normalized)) {
      headers.set(key, value);
    }
  }

  headers.set('authorization', `Bearer ${apiKey}`);
  return headers;
}

function createResponseHeaders(upstream: Response) {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (ALLOWED_RESPONSE_HEADERS.has(normalized) || normalized.startsWith('openai-')) {
      headers.set(key, value);
    }
  });

  headers.set('cache-control', headers.get('cache-control') ?? 'no-store');
  return headers;
}

function validateRequestSize(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) {
    return null;
  }

  const requestBytes = Number(contentLength);
  if (Number.isFinite(requestBytes) && requestBytes > MAX_WORKER_PROXY_REQUEST_BYTES) {
    return jsonResponse(413, {
      error: 'request_body_too_large',
      detail: 'Request body is larger than the Cloudflare proxy limit.',
    });
  }

  return null;
}

async function readRequestBodyWithinLimit(request: Request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return { ok: true as const, body: undefined };
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_WORKER_PROXY_REQUEST_BYTES) {
    return {
      ok: false as const,
      response: jsonResponse(413, {
        error: 'request_body_too_large',
        detail: 'Request body is larger than the Cloudflare proxy limit.',
      }),
    };
  }

  return { ok: true as const, body };
}

export async function handleWorkerOpenAIProxy(
  request: Request,
  env: WorkerOpenAIProxyEnv,
  options: HandleWorkerOpenAIProxyOptions = {},
): Promise<Response> {
  const accessFailure = validateProxyAccess(request, env);
  if (accessFailure) {
    return accessFailure;
  }

  const proxyPath = resolveOpenAIProxyPath(request);
  if (!proxyPath) {
    return jsonResponse(404, {
      error: 'unsupported_openai_proxy_route',
      detail: 'Only /models, /images/generations, and /images/edits are exposed by the hosted TokenCanvas proxy.',
    });
  }

  const sizeFailure = validateRequestSize(request);
  if (sizeFailure) {
    return sizeFailure;
  }

  const bodyResult = await readRequestBodyWithinLimit(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const fetcher = options.fetcher ?? fetch;
  const upstreamURL = `${DEFAULT_OPENAI_BASE_URL}${proxyPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? WORKER_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetcher(upstreamURL, {
      method: request.method,
      headers: createUpstreamHeaders(request, env.OPENAI_API_KEY ?? ''),
      body: bodyResult.body,
      signal: controller.signal,
    });

    const responseText = await upstream.text();
    return new Response(redactSensitiveDetail(responseText), {
      status: upstream.status,
      headers: createResponseHeaders(upstream),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return jsonResponse(504, {
        error: 'openai_proxy_request_timeout',
        detail: 'OpenAI proxy request timed out.',
      });
    }

    return jsonResponse(502, {
      error: 'openai_proxy_request_failed',
      detail: redactSensitiveDetail(error instanceof Error ? error.message : String(error)),
    });
  } finally {
    clearTimeout(timeout);
  }
}
