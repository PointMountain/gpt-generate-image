import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';
import {
  BACKGROUND_VALUES,
  DEFAULT_IMAGE_MODEL,
  FORMAT_VALUES,
  QUALITY_VALUES,
  SIZE_VALUES,
} from '../../lib/openai/openai-option-sets';
import type { HistoryEntry, ResultImage } from './history-types';

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readEnum(value: unknown, allowedValues: Set<string>, fallback: string) {
  return typeof value === 'string' && allowedValues.has(value) ? value : fallback;
}

function readNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeMode(value: unknown): GenerationMode {
  if (value === 'reference') {
    return 'image';
  }

  return value === 'text' || value === 'image' || value === 'mask' ? value : 'text';
}

function normalizeImages(value: unknown): ResultImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      return [];
    }

    const image = candidate as Partial<ResultImage>;
    if (typeof image.src !== 'string' || !image.src) {
      return [];
    }

    return [{
      ...image,
      id: readString(image.id, `history-image-${index + 1}`),
      src: image.src,
      source: image.source === 'base64' || image.source === 'url'
        ? image.source
        : image.src.startsWith('data:') ? 'base64' : 'url',
    } as ResultImage];
  });
}

export function normalizeHistoryEntry(entry: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: readString(entry.id, `history-${Date.now()}`),
    modelId: readString(entry.modelId, DEFAULT_IMAGE_MODEL),
    prompt: readString(entry.prompt, ''),
    size: readEnum(entry.size, SIZE_VALUES, '1024x1024'),
    count: readNumber(entry.count, 1, 1, 4),
    quality: readEnum(entry.quality, QUALITY_VALUES, 'auto'),
    outputFormat: readEnum(entry.outputFormat, FORMAT_VALUES, 'auto'),
    background: readEnum(entry.background, BACKGROUND_VALUES, 'auto'),
    outputCompression: readNumber(entry.outputCompression, 0, 0, 100),
    mode: normalizeMode(entry.mode),
    referencePreviewUrls: Array.isArray(entry.referencePreviewUrls)
      ? entry.referencePreviewUrls.filter((url): url is string => typeof url === 'string')
      : undefined,
    maskPreviewUrl: typeof entry.maskPreviewUrl === 'string' ? entry.maskPreviewUrl : undefined,
    images: normalizeImages(entry.images),
    createdAt: readString(entry.createdAt, new Date().toISOString()),
  };
}
