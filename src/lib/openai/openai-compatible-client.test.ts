import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProviderDraft } from '../../features/providers/provider-store';
import { createDefaultGenerationFormState } from '../../features/workbench/generation-form';
import { generateImages } from './openai-compatible-client';

describe('openai-compatible-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a normalized failure when provider rejects the request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    const provider = createEmptyProviderDraft({
      baseUrl: 'https://example.com',
      apiKey: 'bad-key',
      preferredModel: 'gpt-image-1',
    });
    const form = createDefaultGenerationFormState();

    const result = await generateImages(provider, {
      prompt: 'warm portrait',
      negativePrompt: '',
      size: form.size,
      count: form.count,
      quality: form.quality,
      outputFormat: form.outputFormat,
      mode: form.mode,
      referenceFile: null,
      selectedModelId: 'gpt-image-1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('生成失败');
    }
  });

  it('adds provider-specific timeout advice when upstream returns 504', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error code: 504', {
        status: 504,
        statusText: 'Gateway Timeout',
      }),
    );

    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
      apiKey: 'test-key',
      preferredModel: 'gpt-image-1.5',
    });
    const form = createDefaultGenerationFormState();

    const result = await generateImages(provider, {
      prompt: 'poster of a seaside cafe',
      negativePrompt: '',
      size: 'auto',
      count: form.count,
      quality: 'low',
      outputFormat: 'auto',
      mode: form.mode,
      referenceFile: null,
      selectedModelId: 'gpt-image-1.5',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.recommendation).toContain('自动尺寸');
    }
  });
});
