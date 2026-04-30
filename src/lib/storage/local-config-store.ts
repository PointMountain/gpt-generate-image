import type { ProviderStoreState } from '../../features/providers/provider-types';

const PROVIDERS_KEY = 'gpt-image-workbench/providers';
const PRESETS_KEY = 'gpt-image-workbench/presets';

function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadProviderStore(): Partial<ProviderStoreState> | undefined {
  return parseStoredJson<Partial<ProviderStoreState> | undefined>(
    window.localStorage.getItem(PROVIDERS_KEY),
    undefined,
  );
}

export function saveProviderStore(state: ProviderStoreState) {
  window.localStorage.setItem(PROVIDERS_KEY, JSON.stringify(state));
}

export function loadPresetsFromStorage<T>() {
  return parseStoredJson<T[]>(window.localStorage.getItem(PRESETS_KEY), []);
}

export function savePresetsToStorage<T>(presets: T[]) {
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function clearLocalConfigStore() {
  window.localStorage.removeItem(PROVIDERS_KEY);
  window.localStorage.removeItem(PRESETS_KEY);
}
