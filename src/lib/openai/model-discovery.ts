import type {
  DiscoveryState,
  ModelOption,
  ProviderConfig,
} from '../../features/providers/provider-types';
import { inferLikelyImageModelIds } from './provider-capabilities';
import { resolveProviderProfile, sortModelIdsByProfile } from './provider-profile';
import { resolveProviderRequestUrl, shouldUseLocalProxy } from './local-proxy';

function trimSlashes(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getProviderRootUrl(baseUrl: string) {
  const trimmed = trimSlashes(baseUrl)
    .replace(/\/v\d+\/models$/i, '')
    .replace(/\/v\d+\/images\/generations$/i, '')
    .replace(/\/v\d+\/images\/edits$/i, '');

  if (/\/v\d+$/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}/v1`;
}

export function buildModelsEndpoint(baseUrl: string) {
  return `${getProviderRootUrl(baseUrl)}/models`;
}

function createDiscoveryError(message: string, detail?: string): DiscoveryState {
  return {
    status: 'error',
    models: [],
    likelyModelIds: [],
    message,
    detail,
  };
}

function normalizeDiscoveredModels(payload: unknown): ModelOption[] {
  const data = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data: unknown[] }).data ?? [])
    : Array.isArray(payload)
      ? payload
      : [];

  return data
    .map((item) => {
      if (typeof item === 'string') {
        return { id: item, label: item };
      }

      const record = item as { id?: string; owned_by?: string; ownedBy?: string };
      if (!record.id) {
        return null;
      }

      return {
        id: record.id,
        label: record.id,
        ownedBy: record.owned_by ?? record.ownedBy,
      };
    })
    .filter(Boolean) as ModelOption[];
}

export async function discoverModels(provider: ProviderConfig): Promise<DiscoveryState> {
  const endpoint = buildModelsEndpoint(provider.baseUrl);
  const requestUrl = resolveProviderRequestUrl(provider, endpoint);
  const profile = resolveProviderProfile(provider);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: 'application/json',
      },
    });

    const rawText = await response.text();
    const payload = rawText ? (JSON.parse(rawText) as unknown) : undefined;

    if (!response.ok) {
      return createDiscoveryError(
        `模型探测失败：${response.status} ${response.statusText}`,
        typeof payload === 'object' ? JSON.stringify(payload, null, 2) : rawText,
      );
    }

    const models = normalizeDiscoveredModels(payload);
    const modelMap = new Map(models.map((model) => [model.id, model]));
    const rankedModelIds = sortModelIdsByProfile(
      models.map((model) => model.id),
      profile,
    );
    const rankedModels = rankedModelIds
      .map((modelId) => modelMap.get(modelId))
      .filter(Boolean) as ModelOption[];

    if (!rankedModels.length) {
      return createDiscoveryError('模型探测成功，但 provider 没有返回可用模型。');
    }

    const likelyModelIds = sortModelIdsByProfile(
      inferLikelyImageModelIds(rankedModels),
      profile,
    );

    return {
      status: 'success',
      models: rankedModels,
      likelyModelIds,
      message:
        profile.id === 'default'
          ? `共发现 ${rankedModels.length} 个模型`
          : `共发现 ${rankedModels.length} 个模型，已优先显示兼容推荐模型`,
    };
  } catch (error) {
    return createDiscoveryError(
      shouldUseLocalProxy(provider)
        ? '模型探测请求失败，请检查本地代理、网络或 baseURL。'
        : '模型探测请求失败，请检查网络、CORS 或 baseURL。',
      error instanceof Error ? error.message : String(error),
    );
  }
}
