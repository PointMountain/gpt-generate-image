import type { OpenAIImageSettings } from './ai-sdk-image-client';
import {
  BACKGROUND_VALUES,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  FORMAT_VALUES,
  QUALITY_VALUES,
  SIZE_VALUES,
} from './openai-option-sets';
import { validateOpenAIBaseURL } from './openai-endpoint';

const OPENAI_SETTINGS_KEY = 'gpt-image-workbench/openai-settings';
export const DEFAULT_BROWSER_OPENAI_BASE_URL = 'https://codex.pingchela.xyz/v1';

export interface OpenAISettingsStoreState extends OpenAIImageSettings {
  needsReconfiguration: boolean;
}

export interface OpenAISettingsValidationErrors {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutSeconds?: string;
}

export function createDefaultOpenAISettings(
  overrides: Partial<OpenAISettingsStoreState> = {},
): OpenAISettingsStoreState {
  const apiKey = overrides.apiKey ?? '';

  return {
    apiKey,
    baseURL: DEFAULT_BROWSER_OPENAI_BASE_URL,
    useProxy: true,
    model: apiKey.trim() ? DEFAULT_IMAGE_MODEL : '',
    timeoutSeconds: 180,
    defaultSize: '1024x1024',
    defaultQuality: DEFAULT_IMAGE_QUALITY,
    defaultOutputFormat: 'auto',
    defaultBackground: 'auto',
    defaultOutputCompression: 0,
    needsReconfiguration: false,
    ...overrides,
  };
}

function parseStoredJson<T>(value: string | null): T | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readEnum(value: unknown, allowedValues: Set<string>, fallback: string) {
  return typeof value === 'string' && allowedValues.has(value) ? value : fallback;
}

function readFiniteNumber(value: unknown, fallback: number, minimum: number, maximum?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const lowerBounded = Math.max(value, minimum);
  return maximum === undefined ? lowerBounded : Math.min(lowerBounded, maximum);
}

function normalizeStoredSettings(stored: Partial<OpenAISettingsStoreState>) {
  const apiKey = readString(stored.apiKey, '');
  const defaults = createDefaultOpenAISettings({ apiKey });

  return createDefaultOpenAISettings({
    apiKey,
    baseURL: readString(stored.baseURL, defaults.baseURL),
    useProxy: typeof stored.useProxy === 'boolean' ? stored.useProxy : defaults.useProxy,
    model: apiKey.trim() ? readString(stored.model, defaults.model) : '',
    timeoutSeconds: readFiniteNumber(stored.timeoutSeconds, defaults.timeoutSeconds, 5),
    defaultSize: readEnum(stored.defaultSize, SIZE_VALUES, defaults.defaultSize),
    defaultQuality: readEnum(stored.defaultQuality, QUALITY_VALUES, defaults.defaultQuality),
    defaultOutputFormat: readEnum(stored.defaultOutputFormat, FORMAT_VALUES, defaults.defaultOutputFormat),
    defaultBackground: readEnum(stored.defaultBackground, BACKGROUND_VALUES, defaults.defaultBackground),
    defaultOutputCompression: readFiniteNumber(
      stored.defaultOutputCompression,
      defaults.defaultOutputCompression,
      0,
      100,
    ),
    needsReconfiguration: false,
  });
}

export function loadOpenAISettings(): OpenAISettingsStoreState {
  const stored = parseStoredJson<Partial<OpenAISettingsStoreState>>(
    window.localStorage.getItem(OPENAI_SETTINGS_KEY),
  );

  if (stored) {
    return normalizeStoredSettings(stored);
  }

  return createDefaultOpenAISettings();
}

export function saveOpenAISettings(settings: OpenAISettingsStoreState) {
  const { needsReconfiguration: _needsReconfiguration, ...persisted } = settings;
  window.localStorage.setItem(OPENAI_SETTINGS_KEY, JSON.stringify(persisted));
}

export function validateOpenAISettings(settings: OpenAISettingsStoreState) {
  const errors: OpenAISettingsValidationErrors = {};

  if (!settings.apiKey.trim()) {
    errors.apiKey = 'OpenAI API key 不能为空。';
  }

  if (settings.apiKey.trim() && !settings.model.trim()) {
    errors.model = '请选择或填写图片模型。';
  }

  const baseURLValidation = validateOpenAIBaseURL(settings.baseURL);
  if (!baseURLValidation.ok) {
    errors.baseURL = baseURLValidation.message;
  }

  if (!Number.isFinite(settings.timeoutSeconds) || settings.timeoutSeconds < 5) {
    errors.timeoutSeconds = '超时时间至少为 5 秒。';
  }

  return errors;
}
