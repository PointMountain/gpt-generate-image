import { describe, expect, it } from 'vitest';
import { createEmptyProviderDraft } from '../../features/providers/provider-store';
import { buildLocalProxyUrl, resolveProviderRequestUrl } from './local-proxy';

describe('local-proxy', () => {
  it('builds a same-origin proxy url for a target endpoint', () => {
    expect(buildLocalProxyUrl('https://hc0.icu/v1/models')).toContain('/__proxy?target=');
  });

  it('uses the local proxy when provider fallback enables it', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
      fallback: {
        ...createEmptyProviderDraft().fallback,
        useLocalProxy: true,
      },
    });

    expect(resolveProviderRequestUrl(provider, 'https://hc0.icu/v1/models')).toContain('/__proxy?target=');
  });

  it('returns upstream url unchanged when local proxy is off', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
      fallback: {
        ...createEmptyProviderDraft().fallback,
        useLocalProxy: false,
      },
    });

    expect(resolveProviderRequestUrl(provider, 'https://hc0.icu/v1/models')).toBe('https://hc0.icu/v1/models');
  });
});
