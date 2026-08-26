import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OpenAIImageSettings } from '../../lib/openai/ai-sdk-image-client';
import { DEFAULT_OPENAI_BASE_URL, validateOpenAIBaseURL } from '../../lib/openai/openai-endpoint';
import {
  BACKGROUND_VALUES,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  FORMAT_VALUES,
  QUALITY_VALUES,
  SIZE_VALUES,
} from '../../lib/openai/openai-option-sets';

export interface TerminalConfig extends OpenAIImageSettings {
  outputDir: string;
  historyLimit: number;
}

export interface TerminalConfigValidationErrors {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutSeconds?: string;
  outputDir?: string;
}

const CONFIG_FILE_NAME = 'config.json';

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

export function createDefaultTerminalConfig(overrides: Partial<TerminalConfig> = {}): TerminalConfig {
  return {
    apiKey: '',
    baseURL: DEFAULT_OPENAI_BASE_URL,
    useProxy: false,
    model: DEFAULT_IMAGE_MODEL,
    timeoutSeconds: 180,
    defaultSize: '1024x1024',
    defaultQuality: DEFAULT_IMAGE_QUALITY,
    defaultOutputFormat: 'auto',
    defaultBackground: 'auto',
    defaultOutputCompression: 0,
    outputDir: 'tokencanvas-output',
    historyLimit: 18,
    ...overrides,
  };
}

export function normalizeTerminalConfig(stored: Partial<TerminalConfig>): TerminalConfig {
  const defaults = createDefaultTerminalConfig();

  return createDefaultTerminalConfig({
    apiKey: readString(stored.apiKey, defaults.apiKey),
    baseURL: readString(stored.baseURL, defaults.baseURL),
    useProxy: typeof stored.useProxy === 'boolean' ? stored.useProxy : defaults.useProxy,
    model: readString(stored.model, defaults.model),
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
    outputDir: readString(stored.outputDir, defaults.outputDir),
    historyLimit: readFiniteNumber(stored.historyLimit, defaults.historyLimit, 1, 100),
  });
}

export function resolveTerminalConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory = homedir(),
) {
  if (env.TOKENCANVAS_CONFIG_DIR?.trim()) {
    return env.TOKENCANVAS_CONFIG_DIR;
  }

  if (env.XDG_CONFIG_HOME?.trim()) {
    return join(env.XDG_CONFIG_HOME, 'tokencanvas');
  }

  return join(homeDirectory, '.config', 'tokencanvas');
}

export function getTerminalConfigPath(configDir = resolveTerminalConfigDir()) {
  return join(configDir, CONFIG_FILE_NAME);
}

export async function loadTerminalConfig(configDir = resolveTerminalConfigDir()) {
  const configPath = getTerminalConfigPath(configDir);

  try {
    const raw = await readFile(configPath, 'utf8');
    return normalizeTerminalConfig(JSON.parse(raw) as Partial<TerminalConfig>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDefaultTerminalConfig();
    }

    if (error instanceof SyntaxError) {
      throw new Error(`终端配置文件不是有效 JSON：${configPath}`);
    }

    throw error;
  }
}

function getTemporaryConfigPath(configDir: string) {
  return join(configDir, `${CONFIG_FILE_NAME}.tmp`);
}

export async function saveTerminalConfig(
  config: TerminalConfig,
  configDir = resolveTerminalConfigDir(),
) {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const configPath = getTerminalConfigPath(configDir);
  const temporaryPath = getTemporaryConfigPath(configDir);

  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(normalizeTerminalConfig(config), null, 2)}\n`,
      { mode: constants.S_IRUSR | constants.S_IWUSR },
    );
    await rename(temporaryPath, configPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export function validateTerminalConfig(config: TerminalConfig) {
  const errors: TerminalConfigValidationErrors = {};

  if (!config.apiKey.trim()) {
    errors.apiKey = 'OpenAI API key 不能为空。';
  }

  if (!config.model.trim()) {
    errors.model = '模型不能为空。';
  }

  const baseURLValidation = validateOpenAIBaseURL(config.baseURL);
  if (!baseURLValidation.ok) {
    errors.baseURL = baseURLValidation.message;
  }

  if (!Number.isFinite(config.timeoutSeconds) || config.timeoutSeconds < 5) {
    errors.timeoutSeconds = '超时时间至少为 5 秒。';
  }

  if (!config.outputDir.trim()) {
    errors.outputDir = '输出目录不能为空。';
  }

  return errors;
}
