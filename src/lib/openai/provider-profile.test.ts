import { describe, expect, it } from 'vitest';
import { createEmptyProviderDraft } from '../../features/providers/provider-store';
import {
  applyProfileDefaultsToProvider,
  getProfileFailureRecommendation,
  resolveProviderProfile,
  sortModelIdsByProfile,
} from './provider-profile';

describe('provider-profile', () => {
  it('detects hc0 provider by hostname', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu/v1',
    });

    expect(resolveProviderProfile(provider).id).toBe('hc0');
  });

  it('prioritizes recommended models for hc0', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
    });
    const profile = resolveProviderProfile(provider);

    expect(
      sortModelIdsByProfile(['gpt-image-1', 'gpt-image-2', 'gpt-image-1.5'], profile),
    ).toEqual(['gpt-image-1.5', 'gpt-image-2', 'gpt-image-1']);
  });

  it('applies profile defaults to preferred model and response mode', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
    });
    const profile = resolveProviderProfile(provider);
    const nextProvider = applyProfileDefaultsToProvider(provider, profile);

    expect(nextProvider.preferredModel).toBe('gpt-image-1.5');
    expect(nextProvider.fallback.responseMode).toBe('base64');
  });

  it('returns a timeout recommendation for hc0', () => {
    const provider = createEmptyProviderDraft({
      baseUrl: 'https://hc0.icu',
    });

    expect(getProfileFailureRecommendation(provider, 504)).toContain('自动尺寸');
  });
});
