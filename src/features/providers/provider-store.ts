import type { ProviderConfig, ProviderFallbackConfig, ProviderStoreState } from './provider-types';

const DEFAULT_PROVIDER_NAME = '新 provider';

function getDefaultUseLocalProxy() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['127.0.0.1', 'localhost'].includes(window.location.hostname);
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `provider-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultFallbackConfig(): ProviderFallbackConfig {
  return {
    enabled: false,
    useLocalProxy: getDefaultUseLocalProxy(),
    skipDiscovery: false,
    manualModelId: '',
    imageEndpointOverride: '',
    extraHeadersText: '',
    extraQueryText: '',
    supportsReferenceImages: true,
    responseMode: 'auto',
  };
}

export function createEmptyProviderDraft(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  const timestamp = new Date().toISOString();
  const fallback = {
    ...createDefaultFallbackConfig(),
    ...overrides.fallback,
  };

  const draft: ProviderConfig = {
    id: createId(),
    name: DEFAULT_PROVIDER_NAME,
    baseUrl: '',
    apiKey: '',
    preferredModel: '',
    fallback,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };

  draft.fallback = fallback;
  return draft;
}

export function createProviderStoreState(
  stored?: Partial<ProviderStoreState>,
): ProviderStoreState {
  const providers = Array.isArray(stored?.providers)
    ? stored.providers.map((provider) => createEmptyProviderDraft(provider))
    : [];

  const activeProviderId =
    stored?.activeProviderId && providers.some((provider) => provider.id === stored.activeProviderId)
      ? stored.activeProviderId
      : providers[0]?.id ?? null;

  return {
    providers,
    activeProviderId,
  };
}

export function upsertProvider(
  state: ProviderStoreState,
  draft: ProviderConfig,
): ProviderStoreState {
  const nextProvider = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = state.providers.findIndex((provider) => provider.id === draft.id);
  const providers =
    existingIndex >= 0
      ? state.providers.map((provider, index) => (index === existingIndex ? nextProvider : provider))
      : [...state.providers, nextProvider];

  return {
    providers,
    activeProviderId: nextProvider.id,
  };
}

export function removeProvider(
  state: ProviderStoreState,
  providerId: string,
): ProviderStoreState {
  const providers = state.providers.filter((provider) => provider.id !== providerId);
  const activeProviderId =
    state.activeProviderId === providerId ? (providers[0]?.id ?? null) : state.activeProviderId;

  return {
    providers,
    activeProviderId,
  };
}

export function setActiveProvider(
  state: ProviderStoreState,
  providerId: string,
): ProviderStoreState {
  if (!state.providers.some((provider) => provider.id === providerId)) {
    return state;
  }

  return {
    ...state,
    activeProviderId: providerId,
  };
}

export function duplicateProvider(provider: ProviderConfig): ProviderConfig {
  return createEmptyProviderDraft({
    ...provider,
    id: createId(),
    name: `${provider.name} 副本`,
    preferredModel: provider.preferredModel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function getActiveProvider(state: ProviderStoreState): ProviderConfig | null {
  return state.providers.find((provider) => provider.id === state.activeProviderId) ?? null;
}
