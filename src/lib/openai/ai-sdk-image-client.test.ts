import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageModel } from 'ai';
import type { OpenAIProviderSettings } from '@ai-sdk/openai';
import { buildOpenAIProviderOptions, createOpenAIImageCompatibilityFetch, generateOpenAIImages, supportsTransparentBackground, type OpenAIImageGenerationInput, type OpenAIImageSettings } from './ai-sdk-image-client';
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
      prompt: 'warm portrait',
      size: '1024x1024',
    }));
    expect(runGenerateImage.mock.calls[0]?.[0]).not.toHaveProperty('n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.images[0]?.src).toBe('data:image/png;base64,abc123');
    }
  });

  it('falls back to single-image requests when a compatible provider rejects n', async () => {
    const runGenerateImage = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Unknown parameter: 'tools[0].n'."), { statusCode: 400 }))
      .mockResolvedValueOnce({
        images: [{ base64: 'fallback-a', mediaType: 'image/png', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: { openai: { requestId: 'request-a' } },
      })
      .mockResolvedValueOnce({
        images: [{ base64: 'fallback-b', mediaType: 'image/png', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: { openai: { requestId: 'request-b' } },
      });

    const result = await generateOpenAIImages(
      createSettings({ model: 'gpt-image-2' }),
      createInput({ count: 2 }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      images: [
        { src: 'data:image/png;base64,fallback-a' },
        { src: 'data:image/png;base64,fallback-b' },
      ],
    });
    expect(runGenerateImage.mock.calls[0]?.[0]).toMatchObject({ n: 2 });
    expect(runGenerateImage.mock.calls[1]?.[0]).not.toHaveProperty('n');
    expect(runGenerateImage.mock.calls[2]?.[0]).not.toHaveProperty('n');
  });

  it('retries transparent output without the rejected background field and strengthens the prompt', async () => {
    const runGenerateImage = vi.fn()
      .mockRejectedValueOnce(Object.assign(
        new Error('Transparent background is not supported for this model.'),
        { statusCode: 400 },
      ))
      .mockResolvedValueOnce({
        images: [{ base64: 'transparent-fallback', mediaType: 'image/webp', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: {},
      });

    const result = await generateOpenAIImages(
      createSettings({ model: 'gpt-image-2' }),
      createInput({
        outputFormat: 'webp',
        outputCompression: 80,
        background: 'transparent',
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      images: [{ src: 'data:image/webp;base64,transparent-fallback' }],
    });
    expect(runGenerateImage).toHaveBeenCalledTimes(2);
    expect(runGenerateImage.mock.calls[0]?.[0]).toMatchObject({
      prompt: 'warm portrait',
      providerOptions: {
        openai: {
          background: 'transparent',
          outputFormat: 'webp',
          outputCompression: 80,
        },
      },
    });
    expect(runGenerateImage.mock.calls[1]?.[0]).toMatchObject({
      prompt: expect.stringContaining('alpha'),
      providerOptions: {
        openai: {
          outputFormat: 'webp',
          outputCompression: 80,
        },
      },
    });
    expect(runGenerateImage.mock.calls[1]?.[0].providerOptions.openai).not.toHaveProperty('background');
  });

  it('preserves source images and mask when transparent edit output needs a compatibility retry', async () => {
    const sourceFile = new File(['source-image'], 'source.png', { type: 'image/png' });
    const maskFile = new File(['mask-image'], 'mask.png', { type: 'image/png' });
    Object.defineProperty(sourceFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new TextEncoder().encode('source-image').buffer),
    });
    Object.defineProperty(maskFile, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new TextEncoder().encode('mask-image').buffer),
    });
    const runGenerateImage = vi.fn()
      .mockRejectedValueOnce(new Error('Transparent background is not supported for this model.'))
      .mockResolvedValueOnce({
        images: [{ base64: 'transparent-edit', mediaType: 'image/png', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: {},
      });

    const result = await generateOpenAIImages(
      createSettings({ model: 'gpt-image-2' }),
      createInput({
        mode: 'mask',
        outputFormat: 'png',
        background: 'transparent',
        referenceImages: [{ file: sourceFile, previewUrl: 'blob:source' }],
        maskFile,
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    expect(result.ok).toBe(true);
    expect(runGenerateImage.mock.calls[1]?.[0]).toMatchObject({
      prompt: {
        text: expect.stringContaining('alpha'),
        images: [expect.any(Uint8Array)],
        mask: expect.any(Uint8Array),
      },
      providerOptions: {
        openai: {
          outputFormat: 'png',
        },
      },
    });
    expect(runGenerateImage.mock.calls[1]?.[0].providerOptions.openai).not.toHaveProperty('background');
  });

  it('composes transparent and multi-image compatibility fallbacks', async () => {
    const unknownCount = Object.assign(new Error("Unknown parameter: 'tools[0].n'."), { statusCode: 400 });
    const unsupportedTransparent = Object.assign(
      new Error('Transparent background is not supported for this model.'),
      { statusCode: 400 },
    );
    const runGenerateImage = vi.fn()
      .mockRejectedValueOnce(unknownCount)
      .mockRejectedValueOnce(unsupportedTransparent)
      .mockRejectedValueOnce(unknownCount)
      .mockResolvedValueOnce({
        images: [{ base64: 'transparent-a', mediaType: 'image/png', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: {},
      })
      .mockResolvedValueOnce({
        images: [{ base64: 'transparent-b', mediaType: 'image/png', uint8Array: new Uint8Array() }],
        warnings: [],
        providerMetadata: {},
      });

    const result = await generateOpenAIImages(
      createSettings({ model: 'gpt-image-2' }),
      createInput({ count: 2, outputFormat: 'png', background: 'transparent' }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      images: [
        { src: 'data:image/png;base64,transparent-a' },
        { src: 'data:image/png;base64,transparent-b' },
      ],
    });
    expect(runGenerateImage).toHaveBeenCalledTimes(5);
    expect(runGenerateImage.mock.calls[3]?.[0].prompt).toContain('alpha');
    expect(runGenerateImage.mock.calls[4]?.[0].prompt).toContain('alpha');
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

  it('keeps transparent PNG output enabled for gpt-image-2', () => {
    expect(supportsTransparentBackground('gpt-image-2')).toBe(true);
    expect(buildOpenAIProviderOptions(createInput({
      outputFormat: 'png',
      background: 'transparent',
    }), 'gpt-image-2')).toEqual({
      openai: {
        outputFormat: 'png',
        background: 'transparent',
      },
    });
  });

  it('omits a transparent background when JPEG output is requested', () => {
    expect(buildOpenAIProviderOptions(createInput({
      outputFormat: 'jpeg',
      background: 'transparent',
      outputCompression: 82,
    }), 'gpt-image-2')).toEqual({
      openai: {
        outputFormat: 'jpeg',
        outputCompression: 82,
      },
    });
  });

  it('removes single-image count at the final JSON and multipart request boundary', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const compatibleFetch = createOpenAIImageCompatibilityFetch(fetcher);

    await compatibleFetch('https://example.com/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'paper cat', n: 1 }),
    });
    const jsonBody = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(jsonBody).not.toHaveProperty('n');

    const formData = new FormData();
    formData.set('model', 'gpt-image-2');
    formData.set('n', '1');
    await compatibleFetch('https://example.com/images/edits', {
      method: 'POST',
      body: formData,
    });
    expect((fetcher.mock.calls[1]?.[1]?.body as FormData).has('n')).toBe(false);
  });

  it('normalizes legacy quality and PNG compression for gpt-image-2', () => {
    expect(buildOpenAIProviderOptions(createInput({
      quality: 'hd',
      outputFormat: 'png',
      outputCompression: 80,
      background: 'transparent',
    }), 'gpt-image-2')).toEqual({
      openai: {
        outputFormat: 'png',
        background: 'transparent',
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
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
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

  it('explains when a compatible endpoint has no image account available', async () => {
    const result = await generateOpenAIImages(
      createSettings({ baseURL: 'https://compatible.example.com/v1', model: 'gpt-image-2' }),
      createInput(),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage: vi.fn().mockRejectedValue(
          new Error('Failed after 2 attempts. Last error: No available compatible accounts'),
        ),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      message: '兼容端点当前没有可用的图片生成账号。',
      recommendation: '这不是画面描述或尺寸造成的；请稍后重试，或切换到有图片额度的端点或模型。',
    });
  });

  it('normalizes unsupported transparent background errors into actionable copy', async () => {
    const result = await generateOpenAIImages(
      createSettings({ model: 'gpt-image-2' }),
      createInput({
        outputFormat: 'webp',
        background: 'transparent',
      }),
      {},
      {
        createOpenAIProvider: vi.fn(() => createProvider()),
        runGenerateImage: vi.fn().mockRejectedValue(
          Object.assign(new Error('Transparent background is not supported for this model.'), {
            statusCode: 400,
          }),
        ),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('当前模型或兼容端点不支持透明背景。');
      expect(result.recommendation).toBe('改用“自动”或“不透明”背景，或切换到明确支持透明输出的模型端点。');
    }
  });
});
