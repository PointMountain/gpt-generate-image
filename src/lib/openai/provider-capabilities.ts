import type {
  DiscoveryState,
  ModelOption,
  ProviderConfig,
} from '../../features/providers/provider-types';
import { resolveProviderProfile, sortModelIdsByProfile } from './provider-profile';

export interface ProviderCapabilities {
  canDiscoverModels: boolean;
  canUseReferenceImages: boolean;
  responseMode: 'auto' | 'base64' | 'url';
}

const IMAGE_MODEL_PATTERN =
  /(image|dall|flux|sdxl|stable-diffusion|midjourney|playground|kandinsky|vision)/i;

export function inferLikelyImageModelIds(models: ModelOption[]) {
  return models
    .filter((model) => IMAGE_MODEL_PATTERN.test(model.id))
    .map((model) => model.id);
}

export function getProviderCapabilities(
  provider: ProviderConfig | null,
  _discoveryState: DiscoveryState,
): ProviderCapabilities {
  return {
    canDiscoverModels: Boolean(provider && !provider.fallback.skipDiscovery),
    canUseReferenceImages: provider?.fallback.supportsReferenceImages ?? true,
    responseMode: provider?.fallback.responseMode ?? 'auto',
  };
}

export function getBestDefaultModel(
  provider: ProviderConfig | null,
  discoveryState: DiscoveryState,
): string {
  const profile = resolveProviderProfile(provider);

  if (provider?.fallback.manualModelId.trim()) {
    return provider.fallback.manualModelId.trim();
  }

  if (provider?.preferredModel.trim()) {
    return provider.preferredModel.trim();
  }

  const rankedLikelyModelIds = sortModelIdsByProfile(
    discoveryState.likelyModelIds,
    profile,
  );
  const rankedModelIds = sortModelIdsByProfile(
    discoveryState.models.map((model) => model.id),
    profile,
  );

  return rankedLikelyModelIds[0] ?? rankedModelIds[0] ?? '';
}
