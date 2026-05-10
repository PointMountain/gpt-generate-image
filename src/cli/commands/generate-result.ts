import type { GenerationMode, OpenAIImageGenerationInput } from '../../lib/openai/ai-sdk-image-client';
import {
  type ClientResult,
  type OpenAIImageSettings,
} from '../../lib/openai/ai-sdk-image-client';
import { generateOpenAIImagesForCli } from '../openai/rest-image-client';
import { saveGeneratedImages, type SavedImageFile } from '../../lib/openai/node-image-output';
import { readImageInputFromPath, readReferenceImagesFromPaths } from '../io/image-path-input';
import {
  createTerminalHistoryEntry,
  prependTerminalHistoryEntry,
} from '../history/terminal-history-store';
import {
  loadTerminalConfig,
  validateTerminalConfig,
  type TerminalConfig,
} from '../config/terminal-config-store';

export interface GenerateCommandOptions {
  prompt?: string;
  mode?: GenerationMode;
  outputDir?: string;
  reference?: string[];
  mask?: string;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutSeconds?: number;
  size?: string;
  count?: number;
  quality?: string;
  outputFormat?: string;
  background?: string;
  outputCompression?: number;
  proxy?: 'on' | 'off';
  json?: boolean;
  configDir?: string;
}

export interface GenerateCommandSuccess {
  ok: true;
  mode: GenerationMode;
  model: string;
  outputFiles: SavedImageFile[];
  warning?: string;
}

export interface GenerateCommandFailure {
  ok: false;
  message: string;
  detail?: string;
  recommendation?: string;
}

export type GenerateCommandResult = GenerateCommandSuccess | GenerateCommandFailure;

interface GenerateCommandDeps {
  loadConfig?: typeof loadTerminalConfig;
  generateImages?: (
    settings: OpenAIImageSettings,
    input: OpenAIImageGenerationInput,
  ) => Promise<ClientResult>;
  saveImages?: typeof saveGeneratedImages;
  saveHistory?: typeof prependTerminalHistoryEntry;
}

function mergeSettings(config: TerminalConfig, options: GenerateCommandOptions): TerminalConfig {
  return {
    ...config,
    apiKey: options.apiKey ?? config.apiKey,
    baseURL: options.baseURL ?? config.baseURL,
    model: options.model ?? config.model,
    timeoutSeconds: options.timeoutSeconds ?? config.timeoutSeconds,
    defaultSize: options.size ?? config.defaultSize,
    defaultQuality: options.quality ?? config.defaultQuality,
    defaultOutputFormat: options.outputFormat ?? config.defaultOutputFormat,
    defaultBackground: options.background ?? config.defaultBackground,
    defaultOutputCompression: options.outputCompression ?? config.defaultOutputCompression,
    useProxy: options.proxy ? options.proxy === 'on' : config.useProxy,
    outputDir: options.outputDir ?? config.outputDir,
  };
}

export function formatGenerateCommandResult(result: GenerateCommandResult, json = false) {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  if (!result.ok) {
    return [
      `生成失败：${result.message}`,
      result.detail ? `详情：${result.detail}` : '',
      result.recommendation ? `建议：${result.recommendation}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    `生成完成：${result.outputFiles.length} 张图片`,
    `模型：${result.model}`,
    `模式：${result.mode}`,
    result.warning ? `告警：${result.warning}` : '',
    ...result.outputFiles.map((file) => `输出：${file.path}`),
  ].join('\n');
}

function resolveGenerationMode(options: GenerateCommandOptions): GenerationMode {
  if (options.mode) {
    return options.mode;
  }

  if (options.mask?.trim()) {
    return 'mask';
  }

  if ((options.reference ?? []).length > 0) {
    return 'image';
  }

  return 'text';
}

export async function runGenerateCommand(
  options: GenerateCommandOptions,
  deps: GenerateCommandDeps = {},
): Promise<GenerateCommandResult> {
  const loadConfig = deps.loadConfig ?? loadTerminalConfig;
  let config: TerminalConfig;

  try {
    config = await loadConfig(options.configDir);
  } catch (error) {
    return {
      ok: false,
      message: '终端配置读取失败。',
      detail: error instanceof Error ? error.message : String(error),
      recommendation: '检查终端配置文件是否损坏、权限是否正确，或重新执行 TUI 配置流程。',
    };
  }

  const settings = mergeSettings(config, options);
  const errors = validateTerminalConfig(settings);

  if (!options.prompt?.trim()) {
    return {
      ok: false,
      message: '提示词不能为空。',
      recommendation: '使用 --prompt 传入本次生成提示词。',
    };
  }

  if (Object.keys(errors).length) {
    return {
      ok: false,
      message: errors.apiKey ?? errors.model ?? errors.baseURL ?? errors.outputDir ?? '终端配置无效。',
      recommendation: '先运行交互式 TUI 完成终端配置，或修正配置文件后重试。',
    };
  }

  try {
    const mode = resolveGenerationMode(options);
    const referencePaths = options.reference ?? [];
    const referenceImages = mode === 'text'
      ? []
      : await readReferenceImagesFromPaths(referencePaths);
    const maskFile = mode === 'mask' && options.mask
      ? await readImageInputFromPath(options.mask)
      : null;

    if (mode === 'image' && referenceImages.length === 0) {
      return {
        ok: false,
        message: '图生图模式至少需要一张参考图。',
        recommendation: '使用 --reference 传入 PNG、JPEG 或 WEBP 图片路径。',
      };
    }

    if (mode === 'mask' && (!maskFile || referenceImages.length === 0)) {
      return {
        ok: false,
        message: '遮罩编辑需要源图和 mask 文件。',
        recommendation: '使用 --reference 传入源图，并使用 --mask 传入 mask 图片。',
      };
    }

    const input: OpenAIImageGenerationInput = {
      prompt: options.prompt,
      size: settings.defaultSize,
      count: options.count ?? 1,
      quality: settings.defaultQuality,
      outputFormat: settings.defaultOutputFormat,
      background: settings.defaultBackground,
      outputCompression: settings.defaultOutputCompression,
      mode,
      referenceImages,
      maskFile,
    };
    const generateImages = deps.generateImages ?? ((nextSettings, nextInput) => generateOpenAIImagesForCli(nextSettings, nextInput));
    const result = await generateImages(settings, input);

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        detail: result.detail,
        recommendation: result.recommendation,
      };
    }

    const saveImages = deps.saveImages ?? saveGeneratedImages;
    const outputFiles = await saveImages(result.images, {
      outputDir: settings.outputDir,
      outputFormat: input.outputFormat,
      useProxy: settings.useProxy,
      timeoutMs: settings.timeoutSeconds * 1000,
    });

    const saveHistory = deps.saveHistory ?? prependTerminalHistoryEntry;
    let warning: string | undefined;

    try {
      await saveHistory(createTerminalHistoryEntry({
        modelId: settings.model,
        prompt: input.prompt,
        mode: input.mode,
        size: input.size,
        count: input.count,
        quality: input.quality,
        outputFormat: input.outputFormat,
        background: input.background,
        outputCompression: input.outputCompression,
        outputFiles,
      }), {
        configDir: options.configDir,
        limit: settings.historyLimit,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warning = `结果已写入磁盘，但历史记录保存失败：${detail}`;
    }

    return {
      ok: true,
      mode,
      model: settings.model,
      outputFiles,
      warning,
    };
  } catch (error) {
    return {
      ok: false,
      message: '终端生成流程失败。',
      detail: error instanceof Error ? error.message : String(error),
      recommendation: '检查图片路径、输出目录权限和 OpenAI 设置后重试。',
    };
  }
}
