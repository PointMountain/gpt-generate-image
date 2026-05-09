import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_ALLOWED_PROXY_HOSTS = ['*'];
const MAX_PROXY_REQUEST_BYTES = 40 * 1024 * 1024;
const MAX_PROXY_RESPONSE_BYTES = 80 * 1024 * 1024;
const PROXY_TIMEOUT_MS = 190_000;

class OpenAIProxyError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function getAllowedOpenAIProxyHosts(envValue = process.env.OPENAI_DEV_PROXY_ALLOWED_HOSTS) {
  if (!envValue) {
    return DEFAULT_ALLOWED_PROXY_HOSTS;
  }

  return envValue
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
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

function isBlockedProxyHostname(hostname: string) {
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

export function validateOpenAIProxyBaseURL(
  baseURLValue: string,
  allowedHosts = getAllowedOpenAIProxyHosts(),
) {
  let baseURL: URL;
  try {
    baseURL = new URL(baseURLValue);
  } catch {
    throw new OpenAIProxyError(400, 'missing_or_invalid_base_url', 'baseURL is not a valid URL');
  }

  if (baseURL.protocol !== 'https:') {
    throw new OpenAIProxyError(400, 'https_base_url_required', 'baseURL must use https');
  }

  const hostname = baseURL.hostname.toLowerCase();
  if (isBlockedProxyHostname(hostname)) {
    throw new OpenAIProxyError(400, 'blocked_base_url_host', 'baseURL points to a blocked host');
  }

  if (!allowedHosts.includes('*') && !allowedHosts.includes(hostname)) {
    throw new OpenAIProxyError(400, 'base_url_host_not_allowed', 'baseURL host is not allowed by the dev proxy');
  }

  return baseURL;
}

export function buildOpenAIProxyTarget(requestUrl: string | undefined, baseURLValue: string) {
  const baseURL = validateOpenAIProxyBaseURL(baseURLValue);
  const incoming = new URL(requestUrl || '/', 'http://openai-dev-proxy.local');
  const strippedPathname = incoming.pathname.replace(/^\/api\/openai/, '') || '/';
  const relativePathname = strippedPathname.replace(/^\/+/, '');
  const basePathname = baseURL.pathname.endsWith('/') ? baseURL.pathname : `${baseURL.pathname}/`;
  const target = new URL(baseURL.toString());

  target.pathname = `${basePathname}${relativePathname}`.replace(/\/{2,}/g, '/');
  target.search = incoming.search;
  return target;
}

async function readRequestBody(request: IncomingMessage, maxBytes = MAX_PROXY_REQUEST_BYTES) {
  if (!request.method || ['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return undefined;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += nextChunk.byteLength;
    if (totalBytes > maxBytes) {
      throw new OpenAIProxyError(413, 'request_body_too_large', 'request body is too large');
    }
    chunks.push(nextChunk);
  }

  return Buffer.concat(chunks);
}

async function readUpstreamBody(upstream: Response, maxBytes = MAX_PROXY_RESPONSE_BYTES) {
  if (!upstream.body) {
    return Buffer.from(await upstream.arrayBuffer());
  }

  const reader = upstream.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new OpenAIProxyError(502, 'upstream_response_too_large', 'upstream response is too large');
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

function createProxyHeaders(request: IncomingMessage) {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (!value || ['host', 'content-length', 'connection', 'origin', 'referer', 'x-openai-base-url'].includes(key.toLowerCase())) {
      return;
    }

    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  });
  return headers;
}

function writeProxyJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

export async function handleOpenAIProxy(request: IncomingMessage, response: ServerResponse) {
  const baseURL = request.headers['x-openai-base-url'];
  const baseURLValue = Array.isArray(baseURL) ? baseURL[0] : baseURL;

  if (!baseURLValue) {
    writeProxyJson(response, 400, { error: 'missing_or_invalid_base_url' });
    return;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROXY_TIMEOUT_MS);
  const abortUpstream = () => controller.abort();
  request.once('aborted', abortUpstream);
  response.once('close', () => {
    if (!response.writableEnded) {
      abortUpstream();
    }
  });

  try {
    const target = buildOpenAIProxyTarget(request.url, baseURLValue);
    const body = await readRequestBody(request);

    const upstream = await fetch(target, {
      method: request.method,
      headers: createProxyHeaders(request),
      body,
      signal: controller.signal,
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (!['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        response.setHeader(key, value);
      }
    });
    response.end(await readUpstreamBody(upstream));
  } catch (error) {
    if (controller.signal.aborted && !timedOut) {
      return;
    }

    writeProxyJson(response, error instanceof OpenAIProxyError ? error.statusCode : timedOut ? 504 : 502, {
      error: error instanceof OpenAIProxyError ? error.code : timedOut ? 'openai_proxy_timeout' : 'openai_proxy_request_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeoutId);
    request.off('aborted', abortUpstream);
  }
}
