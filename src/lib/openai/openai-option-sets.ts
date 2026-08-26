export interface OpenAIOptionItem {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_IMAGE_QUALITY = 'high';

export const SIZE_OPTIONS: OpenAIOptionItem[] = [
  { value: 'auto', label: '自动' },
  { value: '1024x1024', label: '1024 x 1024' },
  { value: '1536x1024', label: '1536 x 1024' },
  { value: '1024x1536', label: '1024 x 1536' },
  { value: '2048x2048', label: '2048 x 2048' },
];

export const QUALITY_OPTIONS: OpenAIOptionItem[] = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '快速' },
  { value: 'medium', label: '均衡' },
  { value: 'high', label: '高质量' },
  { value: 'standard', label: 'DALL-E 标准', badge: 'Legacy' },
  { value: 'hd', label: 'DALL-E HD', badge: 'Legacy' },
];

export const FORMAT_OPTIONS: OpenAIOptionItem[] = [
  { value: 'auto', label: '自动' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
];

export const BACKGROUND_OPTIONS: OpenAIOptionItem[] = [
  { value: 'auto', label: '自动' },
  { value: 'transparent', label: '透明' },
  { value: 'opaque', label: '不透明' },
];

export const SIZE_VALUES = new Set(SIZE_OPTIONS.map((option) => option.value));
export const QUALITY_VALUES = new Set(QUALITY_OPTIONS.map((option) => option.value));
export const FORMAT_VALUES = new Set(FORMAT_OPTIONS.map((option) => option.value));
export const BACKGROUND_VALUES = new Set(BACKGROUND_OPTIONS.map((option) => option.value));
