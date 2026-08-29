import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';

export interface ResultImage {
  id: string;
  src: string;
  source: 'base64' | 'url';
  mimeType?: string;
  fileName?: string;
  extension?: string;
  width?: number;
  height?: number;
  dimensionStatus?: 'matched' | 'resized' | 'mismatched';
}

export interface HistoryInputImage {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}

export interface HistoryEntry {
  id: string;
  modelId: string;
  prompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  mode: GenerationMode;
  referenceImages?: HistoryInputImage[];
  maskImage?: HistoryInputImage;
  /** Legacy preview-only fields kept so older browser records can still be read. */
  referencePreviewUrls?: string[];
  maskPreviewUrl?: string;
  images: ResultImage[];
  createdAt: string;
}

export interface PresetRecord {
  id: string;
  name: string;
  prompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  mode: GenerationMode;
  modelId: string;
  createdAt: string;
}
