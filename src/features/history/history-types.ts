export interface ResultImage {
  id: string;
  src: string;
  source: 'base64' | 'url';
  mimeType?: string;
  fileName?: string;
  extension?: string;
}

export interface HistoryEntry {
  id: string;
  providerId: string | null;
  providerLabel: string;
  modelId: string;
  prompt: string;
  negativePrompt: string;
  size: string;
  count: number;
  quality: string;
  mode: 'text' | 'reference';
  referencePreviewUrl?: string;
  images: ResultImage[];
  createdAt: string;
}

export interface PresetRecord {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  mode: 'text' | 'reference';
  providerId: string | null;
  modelId: string;
  createdAt: string;
}
