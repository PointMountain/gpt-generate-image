import type {
  ProviderConfig,
  ResponseMode,
} from '../../features/providers/provider-types';

export type ProviderProfileId = 'default' | 'hc0';

export interface ProviderProfile {
  id: ProviderProfileId;
  label: string;
  description: string;
  recommendedModelIds: string[];
  recommendedSettings: {
    size: string;
    quality: string;
    outputFormat: string;
    responseMode: ResponseMode;
  };
  notes: string[];
}

const DEFAULT_PROFILE: ProviderProfile = {
  id: 'default',
  label: '标准兼容',
  description: '按 OpenAI-compatible 默认约定发起请求。',
  recommendedModelIds: [],
  recommendedSettings: {
    size: '1024x1024',
    quality: 'high',
    outputFormat: 'png',
    responseMode: 'auto',
  },
  notes: [
    '优先自动探测模型，再选择图片模型。',
    '若标准接口失败，再展开兼容回退补端点或额外参数。',
  ],
};

const HC0_PROFILE: ProviderProfile = {
  id: 'hc0',
  label: 'HC0 兼容配置',
  description: '该 provider 实测对显式尺寸敏感，建议使用更保守的请求参数。',
  recommendedModelIds: ['gpt-image-1.5', 'gpt-image-2', 'gpt-image-1'],
  recommendedSettings: {
    size: 'auto',
    quality: 'low',
    outputFormat: 'auto',
    responseMode: 'base64',
  },
  notes: [
    '优先使用 gpt-image-1.5，其次 gpt-image-2。',
    '尺寸建议交给 provider 自动决定，显式 1024x1024 更容易触发超时。',
    '返回结果优先按 base64 解析，不依赖 URL 模式。',
  ],
};

function getProviderHostname(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function resolveProviderProfile(
  provider: Pick<ProviderConfig, 'baseUrl'> | null,
): ProviderProfile {
  const hostname = getProviderHostname(provider?.baseUrl ?? '');

  if (hostname === 'hc0.icu' || hostname.endsWith('.hc0.icu')) {
    return HC0_PROFILE;
  }

  return DEFAULT_PROFILE;
}

export function sortModelIdsByProfile(
  modelIds: string[],
  profile: ProviderProfile,
): string[] {
  if (!profile.recommendedModelIds.length) {
    return [...modelIds];
  }

  const priority = new Map(
    profile.recommendedModelIds.map((modelId, index) => [modelId, index]),
  );

  return [...modelIds].sort((left, right) => {
    const leftPriority = priority.get(left);
    const rightPriority = priority.get(right);

    if (leftPriority !== undefined && rightPriority !== undefined) {
      return leftPriority - rightPriority;
    }

    if (leftPriority !== undefined) {
      return -1;
    }

    if (rightPriority !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  });
}

export function applyProfileDefaultsToProvider(
  provider: ProviderConfig,
  profile: ProviderProfile,
): ProviderConfig {
  const nextPreferredModel =
    provider.preferredModel.trim() || profile.recommendedModelIds[0] || provider.preferredModel;
  const nextResponseMode =
    provider.fallback.responseMode === 'auto'
      ? profile.recommendedSettings.responseMode
      : provider.fallback.responseMode;

  if (
    nextPreferredModel === provider.preferredModel &&
    nextResponseMode === provider.fallback.responseMode
  ) {
    return provider;
  }

  return {
    ...provider,
    preferredModel: nextPreferredModel,
    fallback: {
      ...provider.fallback,
      responseMode: nextResponseMode,
    },
  };
}

export function getProfileFailureRecommendation(
  provider: ProviderConfig,
  statusCode?: number,
): string | undefined {
  const profile = resolveProviderProfile(provider);

  if (statusCode === 504 && profile.id === 'hc0') {
    return '当前 provider 对显式尺寸更容易超时，优先使用自动尺寸、快速质量，并优先选择 gpt-image-1.5 或 gpt-image-2。';
  }

  if (statusCode === 504) {
    return '上游在网关超时前没有返回结果，可先降低尺寸或质量，再尝试兼容回退。';
  }

  return undefined;
}
