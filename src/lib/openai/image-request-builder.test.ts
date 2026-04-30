import { describe, expect, it } from 'vitest';
import { createEmptyProviderDraft } from '../../features/providers/provider-store';
import { buildImageRequest } from './image-request-builder';

describe('image-request-builder', () => {
  it('omits auto size and quality from json payload', async () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://example.com',
      apiKey: 'test-key',
    });

    const request = buildImageRequest(provider, {
      prompt: 'poster of a seaside cafe',
      negativePrompt: '',
      size: 'auto',
      count: 1,
      quality: 'auto',
      outputFormat: 'auto',
      mode: 'text',
      referenceFile: null,
      selectedModelId: 'gpt-image-2',
    });
    const body = JSON.parse(String(request.init.body));

    expect(body.size).toBeUndefined();
    expect(body.quality).toBeUndefined();
    expect(body.output_format).toBeUndefined();
    expect(body.n).toBeUndefined();
    expect(body.response_format).toBe('b64_json');
  });
});
