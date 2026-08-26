import { describe, expect, it, vi } from 'vitest';
import type { OpenAIImageGenerationInput, OpenAIImageSettings } from '../../lib/openai/ai-sdk-image-client';
import { generateOpenAIImagesForCli } from './rest-image-client';

function createSettings(overrides: Partial<OpenAIImageSettings> = {}): OpenAIImageSettings {
  return {
    apiKey: 'sk-test-secret',
    baseURL: 'https://example.com/v1',
    useProxy: false,
    model: 'gpt-image-2',
    timeoutSeconds: 30,
    defaultSize: '1024x1024',
    defaultQuality: 'auto',
    defaultOutputFormat: 'auto',
    defaultBackground: 'auto',
    defaultOutputCompression: 0,
    ...overrides,
  };
}

function createInput(overrides: Partial<OpenAIImageGenerationInput> = {}): OpenAIImageGenerationInput {
  return {
    prompt: 'warm portrait',
    size: '1024x1024',
    count: 1,
    quality: 'auto',
    outputFormat: 'auto',
    background: 'auto',
    outputCompression: 0,
    mode: 'text',
    referenceImages: [],
    maskFile: null,
    ...overrides,
  };
}

describe('rest-image-client', () => {
  it('posts text image generation directly to the configured OpenAI-compatible baseURL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await generateOpenAIImagesForCli(createSettings(), createInput({
      outputFormat: 'png',
      background: 'transparent',
    }), { fetcher });

    expect(fetcher).toHaveBeenCalledWith('https://example.com/v1/images/generations', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer sk-test-secret',
        'Content-Type': 'application/json',
      }),
      signal: expect.any(AbortSignal),
    }));
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'warm portrait',
      size: '1024x1024',
      output_format: 'png',
      background: 'transparent',
    });
    expect(body).not.toHaveProperty('n');
    expect(body).not.toHaveProperty('response_format');
    expect(result.ok).toBe(true);
  });

  it('sends gpt-image-2 quality, format, and compression when requested', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await generateOpenAIImagesForCli(createSettings(), createInput({
      quality: 'medium',
      outputFormat: 'webp',
      outputCompression: 80,
    }), { fetcher });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      quality: 'medium',
      output_format: 'webp',
      output_compression: 80,
    });
  });

  it('does not send transparent background with JPEG output', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await generateOpenAIImagesForCli(createSettings(), createInput({
      outputFormat: 'jpeg',
      outputCompression: 82,
      background: 'transparent',
    }), { fetcher });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      output_format: 'jpeg',
      output_compression: 82,
    });
    expect(body).not.toHaveProperty('background');
  });

  it('sends non-default output formats for other models when explicitly requested', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await generateOpenAIImagesForCli(createSettings({ model: 'gpt-image-1' }), createInput({
      outputFormat: 'webp',
      outputCompression: 80,
    }), { fetcher });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      output_format: 'webp',
      output_compression: 80,
    });
  });

  it('redacts API keys from REST error details', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'bad key sk-test-secret' },
    }), { status: 401 }));

    const result = await generateOpenAIImagesForCli(createSettings(), createInput(), { fetcher });

    expect(result).toMatchObject({
      ok: false,
      message: 'OpenAI 认证失败。',
      detail: 'bad key sk-[redacted]',
    });
  });

  it('summarizes Cloudflare 524 HTML responses instead of printing the full page', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<!DOCTYPE html><title>pingchela.xyz | 524: A timeout occurred</title><body>sk-test-secret</body>', {
      status: 524,
      statusText: 'A timeout occurred',
    }));

    const result = await generateOpenAIImagesForCli(createSettings(), createInput(), { fetcher });

    expect(result).toMatchObject({
      ok: false,
      message: 'OpenAI 图片生成请求失败。',
      detail: 'pingchela.xyz | 524: A timeout occurred',
      statusCode: 524,
    });
    expect(result.ok ? '' : result.recommendation).toContain('Cloudflare');
  });

  it('explains Cloudflare 5xx gateway failures as upstream errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<title>pingchela.xyz | 502: Bad gateway</title>', {
      status: 502,
      statusText: 'Bad gateway',
    }));

    const result = await generateOpenAIImagesForCli(createSettings(), createInput(), { fetcher });

    expect(result).toMatchObject({
      ok: false,
      detail: 'pingchela.xyz | 502: Bad gateway',
      statusCode: 502,
    });
    expect(result.ok ? '' : result.recommendation).toContain('上游服务或反向代理');
  });

  it('uses the configured timeout for REST image generation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_endpoint: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
      });
    }));

    const promise = generateOpenAIImagesForCli(createSettings({ timeoutSeconds: 5 }), createInput(), { fetcher });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toMatchObject({
      ok: false,
      message: 'OpenAI 图片生成请求超时。',
    });
    vi.useRealTimers();
  });
});
