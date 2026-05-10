import type { OpenAIImageSettings } from './ai-sdk-image-client';
import { resolveOpenAIModelsRequestTarget } from './openai-endpoint';
import { createProxyAwareFetch } from './proxy-aware-fetch';

const GPT_IMAGE_RANK = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1-mini', 'gpt-image-1'];

export interface OpenAIModelListItem {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface ImageModelCandidate {
  id: string;
  label: string;
  family: 'gpt-image' | 'chatgpt-image' | 'dall-e' | 'compatible';
  source: 'remote' | 'current';
  ownedBy?: string;
  created?: number;
  legacy: boolean;
}

export interface ModelDiscoveryFailure {
  ok: false;
  message: string;
  detail?: string;
  statusCode?: number;
  recommendation?: string;
}

export interface ModelDiscoverySuccess {
  ok: true;
  models: ImageModelCandidate[];
  fetchedAt: string;
}

export type ModelDiscoveryResult = ModelDiscoveryFailure | ModelDiscoverySuccess;

interface FetchOpenAIImageModelsDeps {
  fetcher?: typeof fetch;
  now?: () => Date;
  abortSignal?: AbortSignal;
  hostname?: string;
}

function familyForModelId(modelId: string): ImageModelCandidate['family'] {
  const normalized = modelId.trim().toLowerCase();

  if (normalized.startsWith('gpt-image-')) {
    return 'gpt-image';
  }

  if (normalized.startsWith('chatgpt-image-')) {
    return 'chatgpt-image';
  }

  if (normalized.startsWith('dall-e-')) {
    return 'dall-e';
  }

  return 'compatible';
}

export function isImageModelId(modelId: string) {
  const normalized = modelId.trim().toLowerCase();

  return (
    normalized.startsWith('gpt-image-') ||
    normalized.startsWith('chatgpt-image-') ||
    normalized.startsWith('dall-e-') ||
    normalized.endsWith('-image') ||
    normalized.includes('-image-')
  );
}

function labelForModelId(modelId: string) {
  if (modelId.startsWith('gpt-image-')) {
    return `GPT Image ${modelId.replace('gpt-image-', '')}`;
  }

  if (modelId.startsWith('chatgpt-image-')) {
    return `ChatGPT Image ${modelId.replace('chatgpt-image-', '')}`;
  }

  if (modelId.startsWith('dall-e-')) {
    return modelId.toUpperCase();
  }

  return modelId;
}

function rankCandidate(candidate: ImageModelCandidate) {
  const id = candidate.id.toLowerCase();
  const exactRank = GPT_IMAGE_RANK.indexOf(id);

  if (exactRank >= 0) {
    return exactRank;
  }

  if (candidate.family === 'gpt-image') {
    return 20;
  }

  if (candidate.family === 'chatgpt-image') {
    return 30;
  }

  if (candidate.family === 'compatible') {
    return candidate.source === 'current' ? 40 : 50;
  }

  return 80;
}

function sortCandidates(candidates: ImageModelCandidate[]) {
  return [...candidates].sort((left, right) => {
    const rankDelta = rankCandidate(left) - rankCandidate(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function modelListItemToCandidate(model: OpenAIModelListItem, source: ImageModelCandidate['source']): ImageModelCandidate {
  const id = model.id.trim();
  const family = familyForModelId(id);

  return {
    id,
    label: labelForModelId(id),
    family,
    source,
    ownedBy: model.owned_by,
    created: model.created,
    legacy: family === 'dall-e',
  };
}

export function mergeCurrentModelCandidate(
  candidates: ImageModelCandidate[],
  currentModelId: string,
) {
  const normalizedCurrentModelId = currentModelId.trim();
  if (!normalizedCurrentModelId) {
    return sortCandidates(candidates);
  }

  if (candidates.some((candidate) => candidate.id.toLowerCase() === normalizedCurrentModelId.toLowerCase())) {
    return sortCandidates(candidates);
  }

  return sortCandidates([
    ...candidates,
    modelListItemToCandidate({ id: normalizedCurrentModelId }, 'current'),
  ]);
}

function normalizeModelListResponse(payload: unknown): OpenAIModelListItem[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((model): model is OpenAIModelListItem => (
      typeof model === 'object' &&
      model !== null &&
      typeof (model as { id?: unknown }).id === 'string'
    ))
    .map((model) => ({
      id: model.id,
      object: typeof model.object === 'string' ? model.object : undefined,
      created: typeof model.created === 'number' ? model.created : undefined,
      owned_by: typeof model.owned_by === 'string' ? model.owned_by : undefined,
    }));
}

async function readErrorDetail(response: Response) {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as { error?: { message?: unknown } };
    return typeof payload.error?.message === 'string' ? payload.error.message : text;
  } catch {
    return text;
  }
}

function redactSensitiveDetail(detail: string) {
  return detail
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]')
    .replace(/(Authorization\s*[:=]\s*)[^\s,}]+/gi, '$1[redacted]');
}

function normalizeDiscoveryError(error: unknown, statusCode?: number): ModelDiscoveryFailure {
  const detail = redactSensitiveDetail(error instanceof Error ? error.message : String(error));
  const loweredDetail = detail.toLowerCase();

  if (statusCode === 401 || loweredDetail.includes('api key') || loweredDetail.includes('unauthorized')) {
    return {
      ok: false,
      message: 'OpenAI 模型列表认证失败。',
      detail,
      statusCode,
      recommendation: '检查 OpenAI API key 是否正确、是否仍有效，并重新保存设置。',
    };
  }

  if (loweredDetail.includes('failed to fetch') || loweredDetail.includes('cors')) {
    return {
      ok: false,
      message: '浏览器无法拉取当前 provider 的模型列表。',
      detail,
      statusCode,
      recommendation: '检查 baseURL 是否允许从本地页面跨域调用；本地调试自定义端点时可通过 dev proxy 转发。',
    };
  }

  if (loweredDetail.includes('abort') || loweredDetail.includes('cancel') || loweredDetail.includes('timeout')) {
    return {
      ok: false,
      message: '模型列表请求已取消或超时。',
      detail,
      statusCode,
      recommendation: '请稍后重试，或缩短网络链路后再次拉取模型。',
    };
  }

  return {
    ok: false,
    message: 'OpenAI 模型列表拉取失败。',
    detail,
    statusCode,
    recommendation: '检查 baseURL、API key 和当前 provider 是否支持 /models 接口。',
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

export async function fetchOpenAIImageModels(
  settings: OpenAIImageSettings,
  deps: FetchOpenAIImageModelsDeps = {},
): Promise<ModelDiscoveryResult> {
  const fetcher = deps.fetcher ?? createProxyAwareFetch(settings.useProxy);
  const target = resolveOpenAIModelsRequestTarget(
    settings.baseURL,
    deps.hostname,
    settings.useProxy,
    settings.hostedProxy,
    settings.proxyAccessToken,
  );
  if (!target.ok) {
    return {
      ok: false,
      message: 'OpenAI 模型列表拉取失败。',
      detail: target.message,
      recommendation: '先修正高级连接设置里的 baseURL，再重新拉取模型。',
    };
  }

  const timeout = createTimeoutController(settings.timeoutSeconds, deps.abortSignal);
  const headers = new Headers();
  if (settings.hostedProxy) {
    headers.set('x-tokencanvas-proxy-token', target.proxyAccessTokenHeader);
  } else {
    headers.set('Authorization', `Bearer ${settings.apiKey}`);
  }

  if (target.baseURLHeader) {
    headers.set('x-openai-base-url', target.baseURLHeader);
    headers.set('x-openai-use-proxy', target.useProxyHeader);
  }

  try {
    const response = await fetcher(target.url, {
      method: 'GET',
      headers,
      signal: timeout.signal,
    });

    if (!response.ok) {
      return normalizeDiscoveryError(await readErrorDetail(response), response.status);
    }

    const models = normalizeModelListResponse(await response.json())
      .filter((model) => isImageModelId(model.id))
      .map((model) => modelListItemToCandidate(model, 'remote'));

    return {
      ok: true,
      models: mergeCurrentModelCandidate(models, settings.model),
      fetchedAt: (deps.now ?? (() => new Date()))().toISOString(),
    };
  } catch (error) {
    return normalizeDiscoveryError(error);
  } finally {
    timeout.cleanup();
  }
}
