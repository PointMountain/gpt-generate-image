import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import {
  createDefaultTerminalConfig,
  loadTerminalConfig,
  saveTerminalConfig,
  type TerminalConfig,
} from '../config/terminal-config-store';
import { GenerationScreen } from './screens/generation-screen';
import { runGenerateCommand, type GenerateCommandResult } from '../commands/generate-result';
import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';
import { HistoryScreen } from './screens/history-screen';
import { loadTerminalHistory, type TerminalHistoryEntry } from '../history/terminal-history-store';

export interface ConfigPersistenceResult {
  ok: boolean;
  error?: string;
}

interface TuiAppProps {
  initialConfig?: TerminalConfig;
  loadConfigOverride?: typeof loadTerminalConfig;
  saveConfigOverride?: typeof saveTerminalConfig;
  runGenerateOverride?: typeof runGenerateCommand;
}

export async function runTuiGeneration(
  config: TerminalConfig,
  input: {
    prompt: string;
    mode: GenerationMode;
    reference: string[];
    mask?: string;
    count?: number;
  },
  runGenerateImpl: typeof runGenerateCommand = runGenerateCommand,
) {
  return runGenerateImpl({
    prompt: input.prompt,
    mode: input.mode,
    reference: input.reference,
    mask: input.mask,
    count: input.count,
  }, {
    loadConfig: async () => config,
  });
}

export function TuiApp({
  initialConfig,
  loadConfigOverride,
  saveConfigOverride,
  runGenerateOverride,
}: TuiAppProps) {
  const [config, setConfig] = useState<TerminalConfig | null>(initialConfig ?? null);
  const [isLoading, setIsLoading] = useState(!initialConfig);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateCommandResult | null>(null);
  const [configPersistenceError, setConfigPersistenceError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<TerminalHistoryEntry[]>([]);
  const loadConfigImpl = loadConfigOverride ?? loadTerminalConfig;
  const saveConfigImpl = saveConfigOverride ?? saveTerminalConfig;
  const runGenerateImpl = runGenerateOverride ?? runGenerateCommand;

  useEffect(() => {
    if (initialConfig) {
      return;
    }

    let isMounted = true;
    void Promise.allSettled([
      loadConfigImpl(),
      loadTerminalHistory(),
    ]).then(([configResult, historyResult]) => {
      if (!isMounted) {
        return;
      }

      if (configResult.status === 'fulfilled') {
        setConfig(configResult.value);
      } else {
        setConfig(createDefaultTerminalConfig());
        setConfigPersistenceError(`配置加载失败：${configResult.reason instanceof Error ? configResult.reason.message : String(configResult.reason)}。已回退到默认终端配置。`);
      }

      if (historyResult.status === 'fulfilled') {
        setHistoryEntries(historyResult.value);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [initialConfig, loadConfigImpl]);

  if (isLoading || !config) {
    return <Text>加载终端配置...</Text>;
  }

  async function handleGenerate(input: {
    prompt: string;
    mode: GenerationMode;
    reference: string[];
    mask?: string;
    count?: number;
  }) {
    if (!config) {
      setResult({
        ok: false,
        message: '终端配置尚未加载完成。',
        recommendation: '等待配置加载完成后再试。',
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);
    const nextResult = await runTuiGeneration(config, input, runGenerateImpl);
    setResult(nextResult);
    if (nextResult.ok) {
      try {
        setHistoryEntries(await loadTerminalHistory());
      } catch {
        // 历史读取失败不影响当前结果展示，顶部 warning 会保留更强的配置类错误。
      }
    }
    setIsGenerating(false);
  }

  async function handleSaveConfig(nextConfig: TerminalConfig): Promise<ConfigPersistenceResult> {
    setConfig(nextConfig);
    setConfigPersistenceError(null);

    try {
      await saveConfigImpl(nextConfig);
      return { ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setConfigPersistenceError(`配置写入失败：${detail}。当前会话使用内存配置。`);
      return {
        ok: false,
        error: detail,
      };
    }
  }

  return (
    <Box flexDirection="column">
      <GenerationScreen
        config={config}
        configPersistenceError={configPersistenceError}
        isGenerating={isGenerating}
        result={result}
        onSaveConfig={handleSaveConfig}
        onGenerate={handleGenerate}
      />
      <Box marginTop={1}>
        <HistoryScreen entries={historyEntries} />
      </Box>
    </Box>
  );
}

export function createDemoTuiConfig(overrides: Partial<TerminalConfig> = {}) {
  return createDefaultTerminalConfig({
    apiKey: 'sk-demo',
    ...overrides,
  });
}
