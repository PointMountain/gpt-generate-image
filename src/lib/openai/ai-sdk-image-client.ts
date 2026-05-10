import { generateImage, type DataContent, type GenerateImageResult, type ImageModel } from 'ai';
import {
  createOpenAI,
  type OpenAIImageModelEditOptions,
  type OpenAIImageModelGenerationOptions,
  type OpenAIProviderSettings,
} from '@ai-sdk/openai';
import { resolveOpenAIProviderTransport } from './openai-endpoint';
import type { ImageBinaryInput, ImageReferenceInput } from './image-file-adapter';
import { normalizeGeneratedFiles, type NormalizedImageResult } from './response-normalizer';

export type GenerationMode = 'text' | 'image' | 'mask';
export type { ImageBinaryInput, ImageReferenceInput } from './image-file-adapter';

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 40 * 1024 * 1024;

export interface OpenAIImageSettings {
  apiKey: string;
  baseURL: string;
  useProxy: boolean;
  model: string;
  timeoutSeconds: number;
  defaultSize: string;
  defaultQuality: string;
  defaultOutputFormat: string;
  defaultBackground: string;
  defaultOutputCompression: number;
}

export interface OpenAIImageGenerationInput {
  prompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  mode: GenerationMode;
  referenceImages: ImageReferenceInput[];
  maskFile: ImageBinaryInput | null;
}

export interface ClientFailure {
  ok: false;
  message: string;
  detail?: string;
  statusCode?: number;
  recommendation?: string;
}

export interface ClientSuccess {
  ok: true;
  images: NormalizedImageResult[];
  metadata?: GenerateImageResult['providerMetadata'];
}

export type ClientResult = ClientFailure | ClientSuccess;

interface GenerateOpenAIImagesDeps {
  createOpenAIProvider?: (options: OpenAIProviderSettings) => { image: (modelId: string) => ImageModel };
  runGenerateImage?: typeof generateImage;
}

function removeAuto<T extends Record<string, string | number | undefined>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== '' && value !== 'auto'),
  );
}

function supportsTransparentBackground(modelId: string) {
  return modelId.trim().toLowerCase() !== 'gpt-image-2';
}

function shouldSendOutputCompression(outputFormat: string) {
  return outputFormat === 'jpeg' || outputFormat === 'webp';
}

export function buildOpenAIProviderOptions(input: OpenAIImageGenerationInput, modelId = '') {
  const background = input.background === 'transparent' && !supportsTransparentBackground(modelId)
    ? 'auto'
    : input.background;
  const openai = removeAuto({
    quality: input.quality,
    background,
    outputFormat: input.outputFormat,
    outputCompression: shouldSendOutputCompression(input.outputFormat) && input.outputCompression > 0
      ? input.outputCompression
      : undefined,
  }) satisfies Partial<OpenAIImageModelGenerationOptions & OpenAIImageModelEditOptions>;

  return Object.keys(openai).length ? { openai } : undefined;
}

async function fileToDataContent(file: ImageBinaryInput): Promise<DataContent> {
  return new Uint8Array(await file.arrayBuffer());
}

function validateImageFileLimits(input: OpenAIImageGenerationInput): ClientFailure | undefined {
  const files = [
    ...input.referenceImages.map((reference) => reference.file),
    ...(input.maskFile ? [input.maskFile] : []),
  ];
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.size;

    if (!file.type.startsWith('image/')) {
      return {
        ok: false,
        message: '只支持上传图片文件。',
        detail: `${file.name || '未命名文件'} 的类型是 ${file.type || 'unknown'}`,
        recommendation: '请换成 PNG、JPEG 或 WEBP 图片后再生成。',
      };
    }

    if (file.size > MAX_IMAGE_FILE_BYTES) {
      return {
        ok: false,
        message: '单张图片过大。',
        detail: `${file.name || '未命名文件'} 超过 ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)}MB`,
        recommendation: '请先压缩图片，或减少参考图尺寸后再生成。',
      };
    }
  }

  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return {
      ok: false,
      message: '本次上传的图片总大小过大。',
      detail: `总大小超过 ${Math.round(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024)}MB`,
      recommendation: '请减少参考图数量，或压缩图片后再生成。',
    };
  }

  return undefined;
}

async function buildPrompt(input: OpenAIImageGenerationInput) {
  if (input.mode === 'text') {
    return input.prompt;
  }

  // 图生图和 mask 都需要把 File 明确转成 AI SDK 接受的二进制输入。
  const images = await Promise.all(input.referenceImages.map((reference) => fileToDataContent(reference.file)));

  if (input.mode === 'mask' && input.maskFile) {
    return {
      text: input.prompt,
      images,
      mask: await fileToDataContent(input.maskFile),
    };
  }

  return {
    text: input.prompt,
    images,
  };
}

function createTimeoutController(timeoutSeconds: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), Math.max(timeoutSeconds, 1) * 1000);

  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    },
  };
}

function normalizeError(error: unknown): ClientFailure {
  const detail = redactSensitiveDetail(error instanceof Error ? error.message : String(error));
  const loweredDetail = detail.toLowerCase();
  const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : undefined;

  if (loweredDetail.includes('failed to fetch')) {
    return {
      ok: false,
      message: '浏览器无法连接到当前 baseURL。',
      detail,
      statusCode,
      recommendation: '检查 baseURL 是否允许从本地页面跨域调用；如果服务端没有开放 CORS，需要改用后端代理或允许 localhost 来源。',
    };
  }

  if (loweredDetail.includes('abort') || loweredDetail.includes('cancel') || loweredDetail.includes('timeout')) {
    return {
      ok: false,
      message: '请求已取消或超时。',
      detail,
      statusCode,
      recommendation: '可以减少图片张数、降低质量，或稍后重新生成。',
    };
  }

  if (statusCode === 401 || loweredDetail.includes('api key') || loweredDetail.includes('unauthorized')) {
    return {
      ok: false,
      message: 'OpenAI 认证失败。',
      detail,
      statusCode,
      recommendation: '检查 OpenAI API key 是否正确、是否仍有效，并重新保存设置。',
    };
  }

  if (statusCode === 429 || loweredDetail.includes('rate limit') || loweredDetail.includes('quota')) {
    return {
      ok: false,
      message: 'OpenAI 当前拒绝了请求。',
      detail,
      statusCode,
      recommendation: '检查额度和速率限制，或稍后重试。',
    };
  }

  return {
    ok: false,
    message: 'OpenAI 图片生成请求失败。',
    detail,
    statusCode,
    recommendation: '检查模型、尺寸、质量和图片输入是否被当前 OpenAI 模型支持。',
  };
}

function redactSensitiveDetail(detail: string) {
  return detail
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]')
    .replace(/(Authorization\s*[:=]\s*)[^\s,}]+/gi, '$1[redacted]');
}

export async function generateOpenAIImages(
  settings: OpenAIImageSettings,
  input: OpenAIImageGenerationInput,
  options: { abortSignal?: AbortSignal } = {},
  deps: GenerateOpenAIImagesDeps = {},
): Promise<ClientResult> {
  const transport = resolveOpenAIProviderTransport(settings.baseURL, undefined, settings.useProxy);
  if (!transport.ok) {
    return {
      ok: false,
      message: 'OpenAI 图片生成请求失败。',
      detail: transport.message,
      recommendation: '先修正高级连接设置里的 baseURL，再重新生成。',
    };
  }

  const openai = (deps.createOpenAIProvider ?? createOpenAI)({
    apiKey: settings.apiKey,
    baseURL: transport.baseURL,
    fetch: transport.fetch,
  });
  const runGenerateImage = deps.runGenerateImage ?? generateImage;
  const timeout = createTimeoutController(settings.timeoutSeconds, options.abortSignal);

  try {
    const imageLimitError = validateImageFileLimits(input);
    if (imageLimitError) {
      return imageLimitError;
    }

    const result = await runGenerateImage({
      model: openai.image(settings.model) as ImageModel,
      // 这里保留 AI SDK 的抽象：调用侧只给文本/图片/mask，SDK 负责选择 OpenAI 请求形状。
      prompt: await buildPrompt(input),
      n: input.count,
      size: input.size === 'auto' ? undefined : input.size as `${number}x${number}`,
      providerOptions: buildOpenAIProviderOptions(input, settings.model),
      maxRetries: 1,
      abortSignal: timeout.signal,
    });
    const images = normalizeGeneratedFiles(result.images);

    if (!images.length) {
      return {
        ok: false,
        message: 'OpenAI 已返回结果，但没有可用图片。',
        detail: JSON.stringify(result.warnings ?? []),
        recommendation: '检查当前模型是否支持图片输出，并尝试降低张数或更换尺寸。',
      };
    }

    return {
      ok: true,
      images,
      metadata: result.providerMetadata,
    };
  } catch (error) {
    return normalizeError(error);
  } finally {
    timeout.cleanup();
  }
}
