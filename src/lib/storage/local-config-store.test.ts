import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProviderDraft, createProviderStoreState } from '../../features/providers/provider-store';
import {
  clearLocalConfigStore,
  loadProviderStore,
  saveProviderStore,
} from './local-config-store';

describe('local-config-store', () => {
  beforeEach(() => {
    clearLocalConfigStore();
  });

  it('persists and reloads provider state', () => {
    const provider = createEmptyProviderDraft({
      name: 'Saved provider',
      baseUrl: 'https://example.com/v1',
      apiKey: 'key',
    });
    const state = createProviderStoreState({
      providers: [provider],
      activeProviderId: provider.id,
    });

    saveProviderStore(state);

    expect(loadProviderStore()).toEqual(state);
  });

  it('returns undefined when storage is corrupted', () => {
    window.localStorage.setItem('gpt-image-workbench/providers', '{oops');

    expect(loadProviderStore()).toBeUndefined();
  });
});
