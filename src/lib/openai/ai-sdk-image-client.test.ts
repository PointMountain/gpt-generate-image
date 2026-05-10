import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageModel } from 'ai';
import type { OpenAIProviderSettings } from '@ai-sdk/openai';
import { buildOpenAIProviderOptions, generateOpenAIImages, type OpenAIImageGenerationInput, type OpenAIImageSettings } from './ai-sdk-image-client';
import { createImageInputFromBytes } from './image-file-adapter';

function createSettings(overrides: Partial<OpenAIImageSettings> = {}): OpenAIImageSettings {
  return {
    apiKey: 'test-key',
    baseURL: 'https://api.openai.com/v1',
    useProxy: false,
    model: 'gpt-image-1',
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

function createProvider() {
  return {
    image: vi.fn((modelId: string) => ({ provider: 'openai', modelId }) as ImageModel),
  };
}

describe('ai-sdk-image-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls generateImage with an OpenAI image model and normalizes images', async () => {
    const provider = createProvider();
    const runGenerateImage = vi.fn().mockResolvedValue({
      images: [{ base64: 'abc123', mediaType: 'image/png', uint8Array: new Uint8Array() }],
      warnings: [],
      providerMetadata: {},
    });

    const result = await generateOpenAIImages(
      createSettings(),
      createInput(),
      {},
      {
        createOpenAIProvider: vi.fn(() => provider),
        runGenerateImage,
      },
    );

    expect(provider.image).toHaveBeenCalledWith('gpt-image-1');
    expect(runGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
      n: 1,
      prompt: 'warm portrait',
      size: '1024x1024',
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.images[0]?.src).toBe('data:image/png;base64,abc123');
    }
  });

  it('drops auto and empty OpenAI provider options', () => {
    expect(buildOpenAIProviderOptions(createInput())).toBeUndefined();
    expect(buildOpenAIProviderOptions(createInput({
      quality: 'high',
      outputFormat: 'png',
      background: 'transparent',
      outputCompression: 80,
    }))).toEqual({
      openai: {
        quality: 'high',
        outputFormat: 'png',
        background: 'transparent',
      },
    });
    expect(buildOpenAIProviderOptions(createInput({
      outputFormat: 'webp',
      outputCompression: 80,
    }))).toEqual({
      openai: {
        outputFormat: 'webp',
        outputCompression: 80,
      },
    });
  });

  it('normalizes unsupported gpt-image-2 provider option combinations', () => {
    expect(buildOpenAIProviderOptions(createInput({
      outputFormat: 'png',
      outputCompression: 80,
      background: 'transparent',
    }), 'gpt-image-2')).toEqual({
      openai: {
        outputFormat: 'png',
      },
    });
  });

  it('sends structured image prompt when reference images are present', async () => {
    const file = new File(['fake-image'], 'reference.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new TextEncoder().encode('fake-image').buffer),
    });
    const runGenerateImage = vi.fn().mockResolvedValue({
      images: [{ base64: 'abc123', mediaType: 'image/png', uint8Array: new Uint8Array() }],
      warnings: [],
      providerMetadata: {},
    });

    const result = await generateOpenAIImages(
      createSettings(),
      createInput({
        mode: 'image',
        referenceImages: [{ file, previewUrl: 'blob:reference' }],
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    if (!result.ok) {
      throw new Error(result.detail);
    }

    expect(runGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.objectContaining({
        text: 'warm portrait',
        images: [expect.any(Uint8Array)],
      }),
    }));
  });

  it('supports runtime-neutral image inputs without browser File objects', async () => {
    const runGenerateImage = vi.fn().mockResolvedValue({
      images: [{ base64: 'abc123', mediaType: 'image/png', uint8Array: new Uint8Array() }],
      warnings: [],
      providerMetadata: {},
    });

    const result = await generateOpenAIImages(
      createSettings(),
      createInput({
        mode: 'image',
        referenceImages: [{
          file: createImageInputFromBytes({
            bytes: new TextEncoder().encode('node-image'),
            name: 'reference.png',
            type: 'image/png',
          }),
          previewUrl: 'file:///reference.png',
        }],
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    if (!result.ok) {
      throw new Error(result.detail);
    }

    expect(runGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.objectContaining({
        images: [expect.any(Uint8Array)],
      }),
    }));
  });

  it('sends structured mask prompt when mask editing is selected', async () => {
    const referenceFile = new File(['source-image'], 'source.png', { type: 'image/png' });
    const maskFile = new File(['mask-image'], 'mask.png', { type: 'image/png' });
    Object.defineProperty(referenceFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new TextEncoder().encode('source-image').buffer),
    });
    Object.defineProperty(maskFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new TextEncoder().encode('mask-image').buffer),
    });
    const runGenerateImage = vi.fn().mockResolvedValue({
      images: [{ base64: 'abc123', mediaType: 'image/png', uint8Array: new Uint8Array() }],
      warnings: [],
      providerMetadata: {},
    });

    const result = await generateOpenAIImages(
      createSettings(),
      createInput({
        mode: 'mask',
        referenceImages: [{ file: referenceFile, previewUrl: 'blob:source' }],
        maskFile,
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    if (!result.ok) {
      throw new Error(result.detail);
    }

    expect(runGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: {
        text: 'warm portrait',
        images: [expect.any(Uint8Array)],
        mask: expect.any(Uint8Array),
      },
    }));
  });

  it('uses the local dev proxy fetch for compatible baseURL values', async () => {
    const provider = createProvider();
    let capturedOptions: OpenAIProviderSettings | undefined;
    const createOpenAIProvider = vi.fn((options: OpenAIProviderSettings) => {
      capturedOptions = options;
      return provider;
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await generateOpenAIImages(
      createSettings({
        baseURL: 'https://example.com/v1',
        model: 'gpt-image-2',
      }),
      createInput(),
      {},
      {
        createOpenAIProvider,
        runGenerateImage: vi.fn().mockResolvedValue({
          images: [{ base64: 'abc123', mediaType: 'image/png', uint8Array: new Uint8Array() }],
          warnings: [],
          providerMetadata: {},
        }),
      },
    );

    expect(capturedOptions?.baseURL).toBeUndefined();
    expect(capturedOptions?.fetch).toEqual(expect.any(Function));

    await capturedOptions?.fetch?.('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: 'Bearer test-key' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/openai/images/generations', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
    }));
    const proxiedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(proxiedHeaders.get('x-openai-base-url')).toBe('https://example.com/v1');
    expect(proxiedHeaders.get('x-openai-use-proxy')).toBe('false');
  });

  it('fails fast when baseURL is not a valid HTTPS endpoint', async () => {
    const createOpenAIProvider = vi.fn();

    const result = await generateOpenAIImages(
      createSettings({ baseURL: 'http://example.com/v1' }),
      createInput(),
      {},
      {
        createOpenAIProvider,
        runGenerateImage: vi.fn(),
      },
    );

    expect(createOpenAIProvider).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      detail: 'baseURL 需要以 https:// 开头。',
    });
  });

  it('rejects oversized reference images before reading them into memory', async () => {
    const file = new File(['small'], 'large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    const arrayBuffer = vi.fn();
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer });
    const runGenerateImage = vi.fn();

    const result = await generateOpenAIImages(
      createSettings(),
      createInput({
        mode: 'image',
        referenceImages: [{ file, previewUrl: 'blob:large' }],
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    expect(result.ok).toBe(false);
    expect(runGenerateImage).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('normalizes auth errors into actionable copy', async () => {
    const error = Object.assign(new Error('Unauthorized: invalid api key'), { statusCode: 401 });
    const result = await generateOpenAIImages(
      createSettings(),
      createInput(),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage: vi.fn().mockRejectedValue(error),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('OpenAI 认证失败。');
      expect(result.recommendation).toContain('OpenAI API key');
    }
  });

  it('normalizes abort and timeout errors without returning images', async () => {
    const result = await generateOpenAIImages(
      createSettings(),
      createInput(),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('请求已取消或超时。');
    }
  });

  it('normalizes browser fetch failures into baseURL advice', async () => {
    const result = await generateOpenAIImages(
      createSettings({ baseURL: 'https://example.com' }),
      createInput(),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('浏览器无法连接到当前 baseURL。');
      expect(result.recommendation).toContain('CORS');
    }
  });
});
