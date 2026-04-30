import type { ProviderConfig } from '../../features/providers/provider-types';
import { buildImageRequest, type ImageGenerationInput } from './image-request-builder';
import { discoverModels } from './model-discovery';
import { getProfileFailureRecommendation } from './provider-profile';
import { normalizeImageResponse, type NormalizedImageResult } from './response-normalizer';

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
}

export type ClientResult = ClientFailure | ClientSuccess;

async function parseResponsePayload(response: Response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      payload: undefined,
      detail: '',
    };
  }

  try {
    return {
      payload: JSON.parse(rawText) as unknown,
      detail: rawText,
    };
  } catch {
    return {
      payload: rawText,
      detail: rawText,
    };
  }
}

export async function runModelDiscovery(provider: ProviderConfig) {
  return discoverModels(provider);
}

export async function generateImages(
  provider: ProviderConfig,
  input: ImageGenerationInput,
): Promise<ClientResult> {
  const request = buildImageRequest(provider, input);

  try {
    const response = await fetch(request.url, request.init);
    const { payload, detail } = await parseResponsePayload(response);

    if (!response.ok) {
      return {
        ok: false,
        message: `生成失败：${response.status} ${response.statusText}`,
        detail,
        statusCode: response.status,
        recommendation: getProfileFailureRecommendation(provider, response.status),
      };
    }

    const images = normalizeImageResponse(payload, provider.fallback.responseMode);

    if (!images.length) {
      return {
        ok: false,
        message: 'provider 已返回结果，但当前无法解析图片字段。',
        detail,
      };
    }

    return {
      ok: true,
      images,
    };
  } catch (error) {
    return {
      ok: false,
      message: '生成请求失败，请检查网络、CORS 或兼容回退配置。',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
