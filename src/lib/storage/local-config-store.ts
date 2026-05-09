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

export function loadPresetsFromStorage<T>() {
  return parseStoredJson<T[]>(window.localStorage.getItem(PRESETS_KEY), []);
}

export function savePresetsToStorage<T>(presets: T[]) {
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function clearLocalConfigStore() {
  window.localStorage.removeItem(PRESETS_KEY);
}
