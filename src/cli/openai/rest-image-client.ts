import { generateOpenAIImages, type ClientResult, type OpenAIImageGenerationInput, type OpenAIImageSettings } from '../../lib/openai/ai-sdk-image-client';
import { normalizeOpenAIBaseURL, validateOpenAIBaseURL } from '../../lib/openai/openai-endpoint';
import { normalizeImageResponse } from '../../lib/openai/response-normalizer';
import { createProxyAwareFetch } from '../../lib/openai/proxy-aware-fetch';

interface RestImageGenerationDeps {
  fetcher?: typeof fetch;
}

function redactSensitiveDetail(detail: string) {
  return detail
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/(Authorization\s*[:=]\s*)[^\s,}]+/gi, '$1[redacted]');
}

function createTimeoutController(timeoutSeconds: number) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), Math.max(timeoutSeconds, 1) * 1000);

  return {
    signal: controller.signal,
    cleanup: () => globalThis.clearTimeout(timeoutId),
  };
}

function extractHtmlTitle(text: string) {
  const title = text.match(/<title>(.*?)<\/title>/is)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim();

  return title || text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

async function readErrorDetail(response: Response) {
  const text = await response.text();
  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const payload = JSON.parse(text) as {
      error?: { message?: string; type?: string; code?: string };
      message?: string;
      detail?: string;
    };
    return payload.error?.message ?? payload.message ?? payload.detail ?? text;
  } catch {
    return extractHtmlTitle(text);
  }
}

function normalizeFailureRecommendation(statusCode: number) {
  if (statusCode === 401) {
    return '检查 API key 是否正确、是否仍有效，并重新保存设置。';
  }

  if (statusCode === 524) {
    return '这是 Cloudflare 到源站的超时，不是本机输入框问题。减少张数/质量后重试；如果你维护该服务，图片生成应改成异步任务轮询，或使用不经过 Cloudflare 100 秒限制的直连域名。';
  }

  if (statusCode >= 500 && statusCode <= 599) {
    return '这是上游服务或反向代理返回的 5xx 错误，不是本机输入框问题。先用低质量/少张数重试；如果仍复现，需要检查 baseURL 背后的图片服务、队列和 Cloudflare/网关超时。';
  }

  return '检查 baseURL、模型、尺寸、质量和输出格式是否被当前服务支持。';
}

function buildTextGenerationBody(settings: OpenAIImageSettings, input: OpenAIImageGenerationInput) {
  const modelId = settings.model.trim().toLowerCase();
  const usesGptImage2 = modelId === 'gpt-image-2';
  const body: Record<string, string | number> = {
    model: settings.model,
    prompt: input.prompt,
    n: input.count,
  };

  if (input.size !== 'auto') {
    body.size = input.size;
  }

  if (!usesGptImage2 && input.quality !== 'auto') {
    body.quality = input.quality;
  }

  if (input.background !== 'auto' && !usesGptImage2) {
    body.background = input.background;
  }

  // WebUI 通过本地代理发出的成功请求不会携带 response_format/output_format。
  // OpenAI-compatible 网关通常默认返回 data[].b64_json；PNG 也作为默认输出处理，避免把某些反代拖进 5xx。
  if (!usesGptImage2 && input.outputFormat !== 'auto' && input.outputFormat !== 'png') {
    body.output_format = input.outputFormat;
  }

  if (!usesGptImage2 && (input.outputFormat === 'jpeg' || input.outputFormat === 'webp') && input.outputCompression > 0) {
    body.output_compression = input.outputCompression;
  }

  return body;
}

async function generateTextImageViaRest(
  settings: OpenAIImageSettings,
  input: OpenAIImageGenerationInput,
  deps: RestImageGenerationDeps = {},
): Promise<ClientResult> {
  const validation = validateOpenAIBaseURL(settings.baseURL);
  if (!validation.ok) {
    return {
      ok: false,
      message: 'OpenAI 图片生成请求失败。',
      detail: validation.message,
      recommendation: '先修正 baseURL，再重新生成。',
    };
  }

  const fetcher = createProxyAwareFetch(settings.useProxy, deps.fetcher ?? fetch);
  const endpoint = `${normalizeOpenAIBaseURL(settings.baseURL)}/images/generations`;
  const timeout = createTimeoutController(settings.timeoutSeconds);

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: timeout.signal,
      body: JSON.stringify(buildTextGenerationBody(settings, input)),
    });

    if (!response.ok) {
      const detail = redactSensitiveDetail(await readErrorDetail(response));
      return {
        ok: false,
        message: response.status === 401 ? 'OpenAI 认证失败。' : 'OpenAI 图片生成请求失败。',
        detail,
        statusCode: response.status,
        recommendation: normalizeFailureRecommendation(response.status),
      };
    }

    const payload = await response.json() as unknown;
    const images = normalizeImageResponse(payload, 'auto');

    if (!images.length) {
      return {
        ok: false,
        message: 'OpenAI 已返回结果，但没有可用图片。',
        detail: redactSensitiveDetail(JSON.stringify(payload)),
        recommendation: '检查当前 baseURL 是否返回 OpenAI 图片 API 兼容的 data[].b64_json 或 data[].url。',
      };
    }

    return {
      ok: true,
      images,
    };
  } catch (error) {
    const detail = redactSensitiveDetail(error instanceof Error ? error.message : String(error));
    const isAbort = error instanceof Error && (error.name === 'AbortError' || detail.toLowerCase().includes('abort'));
    return {
      ok: false,
      message: isAbort ? 'OpenAI 图片生成请求超时。' : 'OpenAI 图片生成请求失败。',
      detail,
      recommendation: isAbort
        ? `当前终端超时为 ${settings.timeoutSeconds} 秒；可以降低质量/张数后重试，或检查服务端是否需要更长的异步生成链路。`
        : '检查网络连接、baseURL 可达性和服务端 OpenAI-compatible 图片接口。',
    };
  } finally {
    timeout.cleanup();
  }
}

export async function generateOpenAIImagesForCli(
  settings: OpenAIImageSettings,
  input: OpenAIImageGenerationInput,
  deps: RestImageGenerationDeps = {},
): Promise<ClientResult> {
  if (input.mode === 'text') {
    return generateTextImageViaRest(settings, input, deps);
  }

  return generateOpenAIImages(settings, input);
}
