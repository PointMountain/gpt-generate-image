import { describe, expect, it } from 'vitest';
import {
  createEmptyProviderDraft,
  createProviderStoreState,
  removeProvider,
  setActiveProvider,
  upsertProvider,
} from './provider-store';

describe('provider-store', () => {
  it('saves a provider and makes it active', () => {
    const state = createProviderStoreState();
    const draft = createEmptyProviderDraft({
      name: 'Alpha',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret',
    });

    const nextState = upsertProvider(state, draft);

    expect(nextState.providers).toHaveLength(1);
    expect(nextState.activeProviderId).toBe(draft.id);
  });

  it('keeps selection when switching between multiple providers', () => {
    const first = createEmptyProviderDraft({
      name: 'A',
      baseUrl: 'https://a.example.com/v1',
      apiKey: 'a',
    });
    const second = createEmptyProviderDraft({
      name: 'B',
      baseUrl: 'https://b.example.com/v1',
      apiKey: 'b',
    });

    let state = upsertProvider(createProviderStoreState(), first);
    state = upsertProvider(state, second);
    state = setActiveProvider(state, first.id);

    expect(state.activeProviderId).toBe(first.id);
  });

  it('falls back to the first remaining provider after delete', () => {
    const first = createEmptyProviderDraft({
      name: 'A',
      baseUrl: 'https://a.example.com/v1',
      apiKey: 'a',
    });
    const second = createEmptyProviderDraft({
      name: 'B',
      baseUrl: 'https://b.example.com/v1',
      apiKey: 'b',
    });

    const state = createProviderStoreState({
      providers: [first, second],
      activeProviderId: second.id,
    });

    const nextState = removeProvider(state, second.id);

    expect(nextState.providers).toHaveLength(1);
    expect(nextState.activeProviderId).toBe(first.id);
  });
});
