import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProviderDraft } from '../../features/providers/provider-store';
import { buildModelsEndpoint, discoverModels } from './model-discovery';

describe('model-discovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds models endpoint from a root base url', () => {
    expect(buildModelsEndpoint('https://example.com')).toBe('https://example.com/v1/models');
    expect(buildModelsEndpoint('https://example.com/v1')).toBe('https://example.com/v1/models');
  });

  it('returns discovered models and likely image ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'gpt-image-1' }, { id: 'gpt-4.1-mini' }],
        }),
      ),
    );

    const provider = createEmptyProviderDraft({
      baseUrl: 'https://example.com',
      apiKey: 'key',
    });

    const result = await discoverModels(provider);

    expect(result.status).toBe('success');
    expect(result.models).toHaveLength(2);
    expect(result.likelyModelIds).toContain('gpt-image-1');
  });
});
