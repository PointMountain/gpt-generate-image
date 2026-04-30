import type { PresetRecord } from '../history/history-types';
import { loadPresetsFromStorage, savePresetsToStorage } from '../../lib/storage/local-config-store';

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadPresets() {
  return loadPresetsFromStorage<PresetRecord>();
}

export function savePresets(presets: PresetRecord[]) {
  savePresetsToStorage(presets);
}

export function createPreset(
  input: Omit<PresetRecord, 'id' | 'createdAt'>,
): PresetRecord {
  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function upsertPreset(presets: PresetRecord[], preset: PresetRecord) {
  const existingIndex = presets.findIndex((entry) => entry.id === preset.id);
  if (existingIndex >= 0) {
    return presets.map((entry, index) => (index === existingIndex ? preset : entry));
  }

  return [preset, ...presets];
}

export function removePreset(presets: PresetRecord[], presetId: string) {
  return presets.filter((preset) => preset.id !== presetId);
}
