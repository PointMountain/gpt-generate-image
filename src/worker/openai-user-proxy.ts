const MAX_PROXY_REQUEST_BYTES = 96 * 1024 * 1024;
const MAX_PROXY_RESPONSE_BYTES = 80 * 1024 * 1024;

const ALLOWED_PROXY_PATHS = new Map([
  ['/models', new Set(['GET'])],
  ['/images/generations', new Set(['POST'])],
  ['/images/edits', new Set(['POST'])],
]);

class WorkerOpenAIProxyError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isAllowedRequestHeader(headerName: string) {
  const normalized = headerName.toLowerCase();

  return [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'openai-organization',
    'openai-project',
  ].includes(normalized);
}

function isAllowedResponseHeader(headerName: string) {
  const normalized = headerName.toLowerCase();

  return (
    normalized === 'content-type' ||
    normalized === 'content-disposition' ||
    normalized === 'cache-control' ||
    normalized === 'etag' ||
    normalized === 'last-modified' ||
    normalized === 'retry-after' ||
    normalized === 'x-request-id' ||
    normalized.startsWith('openai-')
  );
}

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    isPrivateIPv4(normalized)
  );
}

function jsonProxyResponse(status: number, payload: Record<string, unknown>) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function getProxyRoute(request: Request) {
  const url = new URL(request.url);
  const routePath = url.pathname.replace(/^\/api\/openai/, '') || '/';
  const normalizedPath = routePath.endsWith('/') && routePath !== '/'
    ? routePath.slice(0, -1)
    : routePath;
  const allowedMethods = ALLOWED_PROXY_PATHS.get(normalizedPath);

  if (!allowedMethods) {
    throw new WorkerOpenAIProxyError(404, 'openai_proxy_route_not_found', 'OpenAI proxy route is not allowed');
  }

  const method = request.method.toUpperCase();
  if (!allowedMethods.has(method)) {
    throw new WorkerOpenAIProxyError(405, 'openai_proxy_method_not_allowed', 'OpenAI proxy method is not allowed');
  }

  return { path: normalizedPath, search: url.search };
}

function validateBaseURL(value: string | null) {
  if (!value) {
    throw new WorkerOpenAIProxyError(400, 'missing_or_invalid_base_url', 'x-openai-base-url is required');
  }

  let baseURL: URL;
  try {
    baseURL = new URL(value);
  } catch {
    throw new WorkerOpenAIProxyError(400, 'missing_or_invalid_base_url', 'baseURL is not a valid URL');
  }

  if (baseURL.protocol !== 'https:') {
    throw new WorkerOpenAIProxyError(400, 'https_base_url_required', 'baseURL must use https');
  }

  if (baseURL.username || baseURL.password || isBlockedHostname(baseURL.hostname)) {
    throw new WorkerOpenAIProxyError(400, 'blocked_base_url_host', 'baseURL points to a blocked host');
  }

  return baseURL;
}

function buildProxyTarget(baseURL: URL, path: string, search: string) {
  const target = new URL(baseURL.toString());
  const basePathname = target.pathname.endsWith('/') ? target.pathname : `${target.pathname}/`;
  target.pathname = `${basePathname}${path.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  target.search = search;
  return target;
}

function createUpstreamHeaders(request: Request) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (isAllowedRequestHeader(key)) {
      headers.set(key, value);
    }
  });

  if (!headers.has('authorization')) {
    throw new WorkerOpenAIProxyError(401, 'missing_authorization', 'Authorization header is required');
  }

  return headers;
}

async function readRequestBody(request: Request) {
  if (['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return undefined;
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PROXY_REQUEST_BYTES) {
    throw new WorkerOpenAIProxyError(413, 'request_body_too_large', 'request body is too large');
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_PROXY_REQUEST_BYTES) {
    throw new WorkerOpenAIProxyError(413, 'request_body_too_large', 'request body is too large');
  }

  return body;
}

async function createResponseFromUpstream(upstream: Response) {
  const contentLength = Number(upstream.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PROXY_RESPONSE_BYTES) {
    throw new WorkerOpenAIProxyError(502, 'upstream_response_too_large', 'upstream response is too large');
  }

  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (isAllowedResponseHeader(key)) {
      headers.set(key, value);
    }
  });
  headers.set('cache-control', headers.get('cache-control') ?? 'no-store');

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_PROXY_RESPONSE_BYTES) {
    throw new WorkerOpenAIProxyError(502, 'upstream_response_too_large', 'upstream response is too large');
  }

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function handleOpenAIUserProxyRequest(request: Request): Promise<Response> {
  try {
    const route = getProxyRoute(request);
    const baseURL = validateBaseURL(request.headers.get('x-openai-base-url'));
    const target = buildProxyTarget(baseURL, route.path, route.search);

    const upstream = await fetch(target, {
      method: request.method,
      headers: createUpstreamHeaders(request),
      body: await readRequestBody(request),
    });

    return createResponseFromUpstream(upstream);
  } catch (error) {
    const status = error instanceof WorkerOpenAIProxyError ? error.statusCode : 502;
    const code = error instanceof WorkerOpenAIProxyError ? error.code : 'openai_proxy_request_failed';

    return jsonProxyResponse(status, {
      error: code,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
