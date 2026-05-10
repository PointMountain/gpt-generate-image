import { createProxyAwareFetch } from './proxy-aware-fetch';

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

function readBrowserHostname() {
  const maybeWindow = (globalThis as { window?: { location?: { hostname?: string } } }).window;
  if (!maybeWindow?.location?.hostname) {
    return '';
  }

  return maybeWindow.location.hostname;
}

export function normalizeOpenAIBaseURL(baseURL: string) {
  return baseURL.trim().replace(/\/+$/, '') || DEFAULT_OPENAI_BASE_URL;
}

export function validateOpenAIBaseURL(baseURL: string) {
  const normalizedBaseURL = normalizeOpenAIBaseURL(baseURL);

  try {
    const parsedURL = new URL(normalizedBaseURL);
    if (parsedURL.protocol !== 'https:') {
      return {
        ok: false as const,
        message: 'baseURL 需要以 https:// 开头。',
      };
    }
  } catch {
    return {
      ok: false as const,
      message: 'baseURL 需要填写有效的 https:// 地址。',
    };
  }

  return {
    ok: true as const,
    normalizedBaseURL,
  };
}

function isLocalBrowserHost(hostname: string) {
  return ['localhost', '127.0.0.1'].includes(hostname);
}

export function shouldUseOpenAIDevProxy(
  baseURL: string,
  hostname = readBrowserHostname(),
  useProxy = false,
) {
  return isLocalBrowserHost(hostname) && (
    normalizeOpenAIBaseURL(baseURL) !== DEFAULT_OPENAI_BASE_URL ||
    useProxy
  );
}

export function createOpenAIDevProxyFetch(baseURL: string, useProxy = false): typeof fetch {
  const normalizedBaseURL = normalizeOpenAIBaseURL(baseURL);

  return (input, init) => {
    const targetUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const proxiedUrl = targetUrl.replace(/^https:\/\/api\.openai\.com\/v1/i, '/api/openai');
    const headers = new Headers(init?.headers);
    headers.set('x-openai-base-url', normalizedBaseURL);
    headers.set('x-openai-use-proxy', useProxy ? 'true' : 'false');

    return fetch(proxiedUrl, {
      ...init,
      headers,
    });
  };
}

export function resolveOpenAIModelsRequestTarget(
  baseURL: string,
  hostname = readBrowserHostname(),
  useProxy = false,
) {
  const validation = validateOpenAIBaseURL(baseURL);
  if (!validation.ok) {
    return validation;
  }

  if (shouldUseOpenAIDevProxy(validation.normalizedBaseURL, hostname, useProxy)) {
    return {
      ok: true as const,
      url: '/api/openai/models',
      normalizedBaseURL: validation.normalizedBaseURL,
      baseURLHeader: validation.normalizedBaseURL,
      useProxyHeader: useProxy ? 'true' : 'false',
    };
  }

  return {
    ok: true as const,
    url: `${validation.normalizedBaseURL}/models`,
    normalizedBaseURL: validation.normalizedBaseURL,
    baseURLHeader: '',
    useProxyHeader: '',
  };
}

export function resolveOpenAIProviderTransport(
  baseURL: string,
  hostname = readBrowserHostname(),
  useProxy = false,
) {
  const validation = validateOpenAIBaseURL(baseURL);
  if (!validation.ok) {
    return validation;
  }

  if (shouldUseOpenAIDevProxy(validation.normalizedBaseURL, hostname, useProxy)) {
    return {
      ok: true as const,
      normalizedBaseURL: validation.normalizedBaseURL,
      baseURL: undefined,
      fetch: createOpenAIDevProxyFetch(validation.normalizedBaseURL, useProxy),
    };
  }

  return {
    ok: true as const,
    normalizedBaseURL: validation.normalizedBaseURL,
    baseURL: validation.normalizedBaseURL === DEFAULT_OPENAI_BASE_URL
      ? undefined
      : validation.normalizedBaseURL,
    fetch: useProxy ? undefined : createProxyAwareFetch(false),
  };
}
