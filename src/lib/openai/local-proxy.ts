import type { ProviderConfig } from '../../features/providers/provider-types';

export const LOCAL_PROXY_PATH = '/__proxy';

function getLocalProxyOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://127.0.0.1:4173';
}

export function shouldUseLocalProxy(provider: ProviderConfig) {
  return provider.fallback.useLocalProxy;
}

export function buildLocalProxyUrl(targetUrl: string) {
  const proxyUrl = new URL(LOCAL_PROXY_PATH, getLocalProxyOrigin());
  proxyUrl.searchParams.set('target', targetUrl);
  return proxyUrl.toString();
}

export function resolveProviderRequestUrl(provider: ProviderConfig, targetUrl: string) {
  if (!shouldUseLocalProxy(provider)) {
    return targetUrl;
  }

  return buildLocalProxyUrl(targetUrl);
}
