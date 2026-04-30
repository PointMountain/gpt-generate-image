import { describe, expect, it } from 'vitest';
import { normalizeImageResponse } from './response-normalizer';

describe('response-normalizer', () => {
  it('normalizes base64 data results', () => {
    const result = normalizeImageResponse(
      {
        data: [{ b64_json: 'abc123', mime_type: 'image/png' }],
      },
      'base64',
    );

    expect(result[0]?.src).toContain('data:image/png;base64,abc123');
  });

  it('normalizes url results when present', () => {
    const result = normalizeImageResponse(
      {
        data: [{ url: 'https://example.com/image.png' }],
      },
      'auto',
    );

    expect(result[0]?.src).toBe('https://example.com/image.png');
  });
});
