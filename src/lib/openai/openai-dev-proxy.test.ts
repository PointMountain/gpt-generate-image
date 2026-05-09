import { describe, expect, it } from 'vitest';
import { buildOpenAIProxyTarget, validateOpenAIProxyBaseURL } from './openai-dev-proxy';

describe('openai-dev-proxy', () => {
  it('preserves the /v1 pathname when proxying compatible endpoints', () => {
    expect(
      buildOpenAIProxyTarget(
        '/api/openai/images/generations?debug=1',
        'https://example.com/v1',
      ).toString(),
    ).toBe('https://example.com/v1/images/generations?debug=1');
  });

  it('rejects unsafe proxy targets and supports optional host allowlists', () => {
    expect(() => validateOpenAIProxyBaseURL('http://example.com/v1')).toThrow(/https/);
    expect(() => validateOpenAIProxyBaseURL('https://127.0.0.1/v1', ['127.0.0.1'])).toThrow(/blocked/);
    expect(() => validateOpenAIProxyBaseURL('https://blocked.example/v1', ['api.openai.com'])).toThrow(/not allowed/);
    expect(validateOpenAIProxyBaseURL('https://example.com/v1').hostname).toBe('example.com');
  });
});
