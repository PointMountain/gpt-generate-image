import type { PresetRecord } from '../history/history-types';
import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';
import { loadPresetsFromStorage, savePresetsToStorage } from '../../lib/storage/local-config-store';

const SIZE_VALUES = new Set(['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048']);
const QUALITY_VALUES = new Set(['auto', 'low', 'medium', 'high', 'standard', 'hd']);
const FORMAT_VALUES = new Set(['auto', 'png', 'jpeg', 'webp']);
const BACKGROUND_VALUES = new Set(['auto', 'transparent', 'opaque']);

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readEnum(value: unknown, allowedValues: Set<string>, fallback: string) {
  return typeof value === 'string' && allowedValues.has(value) ? value : fallback;
}

function readNumber(value: unknown, fallback: number, minimum: number, maximum?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const lowerBounded = Math.max(value, minimum);
  return maximum === undefined ? lowerBounded : Math.min(lowerBounded, maximum);
}

function normalizeMode(value: unknown): GenerationMode {
  if (value === 'reference') {
    return 'image';
  }
  if (value === 'text' || value === 'image' || value === 'mask') {
    return value;
  }
  return 'text';
}

export function normalizePresetRecord(preset: Partial<PresetRecord>): PresetRecord {
  return {
    id: readString(preset.id, createId()),
    name: readString(preset.name, '未命名预设'),
    prompt: readString(preset.prompt, ''),
    size: readEnum(preset.size, SIZE_VALUES, '1024x1024'),
    count: readNumber(preset.count, 1, 1, 4),
    quality: readEnum(preset.quality, QUALITY_VALUES, 'auto'),
    outputFormat: readEnum(preset.outputFormat, FORMAT_VALUES, 'auto'),
    background: readEnum(preset.background, BACKGROUND_VALUES, 'auto'),
    outputCompression: readNumber(preset.outputCompression, 0, 0, 100),
    mode: normalizeMode(preset.mode),
    modelId: readString(preset.modelId, 'gpt-image-1'),
    createdAt: readString(preset.createdAt, new Date().toISOString()),
  };
}

export function loadPresets() {
  return loadPresetsFromStorage<Partial<PresetRecord>>().map(normalizePresetRecord);
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
