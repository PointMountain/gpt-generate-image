import process from 'node:process';
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import zod from 'zod';
import { option } from 'pastel';
import { formatGenerateCommandResult, runGenerateCommand, type GenerateCommandOptions } from './generate-result';
import {
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
} from '../../lib/openai/openai-option-sets';
import { MAX_GENERATION_COUNT, shouldRenderInkCommandOutput } from '../runtime/terminal-mode';

const SIZE_VALUES = SIZE_OPTIONS.map((option) => option.value) as [string, ...string[]];
const QUALITY_VALUES = QUALITY_OPTIONS.map((option) => option.value) as [string, ...string[]];
const FORMAT_VALUES = FORMAT_OPTIONS.map((option) => option.value) as [string, ...string[]];
const BACKGROUND_VALUES = BACKGROUND_OPTIONS.map((option) => option.value) as [string, ...string[]];

export const options = zod.object({
  prompt: zod.string().optional().describe(option({
    description: 'Prompt for this image generation run',
    alias: 'p',
  })),
  mode: zod.enum(['text', 'image', 'mask']).default('text').describe(option({
    description: 'Generation mode',
    defaultValueDescription: 'text',
  })),
  outputDir: zod.string().optional().describe(option({
    description: 'Directory for generated files',
    alias: 'o',
  })),
  reference: zod.array(zod.string()).default([]).describe(option({
    description: 'Reference image path. Repeat for multiple images.',
  })),
  mask: zod.string().optional().describe(option({
    description: 'Mask image path for mask mode',
  })),
  apiKey: zod.string().optional().describe(option({
    description: 'OpenAI API key override for this run',
  })),
  baseUrl: zod.string().optional().describe(option({
    description: 'OpenAI baseURL override for this run',
  })),
  model: zod.string().optional().describe(option({
    description: 'OpenAI image model override',
  })),
  timeoutSeconds: zod.number().min(5).optional().describe(option({
    description: 'Request timeout in seconds',
  })),
  size: zod.enum(SIZE_VALUES).optional().describe(option({
    description: 'Image size override',
  })),
  count: zod.number().int().min(1).max(MAX_GENERATION_COUNT).default(1).describe(option({
    description: 'Number of images',
    defaultValueDescription: '1',
  })),
  quality: zod.enum(QUALITY_VALUES).optional().describe(option({
    description: 'Quality override',
  })),
  outputFormat: zod.enum(FORMAT_VALUES).optional().describe(option({
    description: 'Output format override',
  })),
  background: zod.enum(BACKGROUND_VALUES).optional().describe(option({
    description: 'Background override',
  })),
  outputCompression: zod.number().int().min(0).max(100).optional().describe(option({
    description: 'Compression for JPEG/WEBP output',
  })),
  proxy: zod.enum(['on', 'off']).optional().describe(option({
    description: 'Use environment HTTP(S) proxy for this run',
  })),
  json: zod.boolean().default(false).describe(option({
    description: 'Print JSON output',
  })),
});

type Props = {
  options: zod.infer<typeof options>;
};

export function normalizeGenerateCommandOptions(
  commandOptions: zod.infer<typeof options>,
): GenerateCommandOptions {
  return {
    prompt: commandOptions.prompt,
    mode: commandOptions.mode,
    outputDir: commandOptions.outputDir,
    reference: commandOptions.reference,
    mask: commandOptions.mask,
    apiKey: commandOptions.apiKey,
    baseURL: commandOptions.baseUrl,
    model: commandOptions.model,
    timeoutSeconds: commandOptions.timeoutSeconds,
    size: commandOptions.size,
    count: commandOptions.count,
    quality: commandOptions.quality,
    outputFormat: commandOptions.outputFormat,
    background: commandOptions.background,
    outputCompression: commandOptions.outputCompression,
    proxy: commandOptions.proxy,
    json: commandOptions.json,
  };
}

export default function GenerateCommand({ options: commandOptions }: Props) {
  const renderWithInk = shouldRenderInkCommandOutput(commandOptions.json);
  const showLoading = !commandOptions.json && renderWithInk;
  const [output, setOutput] = useState(showLoading ? '生成中...' : '');

  useEffect(() => {
    let isMounted = true;
    const normalizedOptions = normalizeGenerateCommandOptions(commandOptions);

    void runGenerateCommand(normalizedOptions).then((result) => {
      process.exitCode = result.ok ? 0 : 1;
      const formatted = formatGenerateCommandResult(result, normalizedOptions.json ?? false);

      if (!renderWithInk) {
        const writer = normalizedOptions.json
          ? process.stdout
          : result.ok
            ? process.stdout
            : process.stderr;
        writer.write(`${formatted}\n`);
        return;
      }

      if (isMounted) {
        setOutput(formatted);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [commandOptions, renderWithInk]);

  if (!renderWithInk || !output) {
    return null;
  }

  return <Text>{output}</Text>;
}
