import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { PasswordInput, TextInput } from '@inkjs/ui';
import type { GenerationMode } from '../../../lib/openai/ai-sdk-image-client';
import {
  BACKGROUND_OPTIONS,
  FORMAT_OPTIONS,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
} from '../../../lib/openai/openai-option-sets';
import type { TerminalConfig } from '../../config/terminal-config-store';
import { validateTerminalConfig } from '../../config/terminal-config-store';
import type { GenerateCommandResult } from '../../commands/generate-result';
import type { ConfigPersistenceResult } from '../tui-app';
import { CommandInput, type SlashCommandDefinition } from '../components/command-input';
import { ConfirmableSelect } from '../components/confirmable-select';
import { StatusPanel } from '../components/status-panel';
import { MAX_GENERATION_COUNT } from '../../runtime/terminal-mode';

interface GenerationScreenProps {
  config: TerminalConfig;
  configPersistenceError?: string | null;
  isGenerating: boolean;
  result: GenerateCommandResult | null;
  onSaveConfig: (config: TerminalConfig) => Promise<ConfigPersistenceResult>;
  onGenerate: (input: {
    prompt: string;
    mode: GenerationMode;
    reference: string[];
    mask?: string;
    count?: number;
  }) => void;
}

type Panel =
  | 'console'
  | 'help'
  | 'apiKey'
  | 'baseURL'
  | 'model'
  | 'mode'
  | 'prompt'
  | 'reference'
  | 'mask'
  | 'outputDir'
  | 'size'
  | 'quality'
  | 'format'
  | 'background'
  | 'count'
  | 'compression';

const COMMANDS: SlashCommandDefinition[] = [
  { name: '/help', syntax: '/help', description: '查看全部指令和用法' },
  { name: '/config', syntax: '/config', description: '逐项配置 API key、baseURL、model、output' },
  { name: '/apikey', syntax: '/apikey [value]', description: '输入或更新 OpenAI API key' },
  { name: '/baseurl', syntax: '/baseurl [url]', description: '输入或更新 OpenAI baseURL' },
  { name: '/proxy', syntax: '/proxy [on|off]', description: '切换是否使用本机环境代理，默认 off' },
  { name: '/mode', syntax: '/mode [text|image|mask]', description: '切换文生图、图生图或 mask 模式' },
  { name: '/size', syntax: '/size [1024x1024]', description: '下拉选择生成尺寸' },
  { name: '/quality', syntax: '/quality [auto|low|medium|high]', description: '下拉选择生成质量' },
  { name: '/format', syntax: '/format [auto|png|jpeg|webp]', description: '下拉选择输出格式' },
  { name: '/background', syntax: '/background [auto|transparent|opaque]', description: '下拉选择背景' },
  { name: '/count', syntax: '/count [number]', description: '设置本次生成张数' },
  { name: '/compression', syntax: '/compression [0-100]', description: '设置 JPEG/WEBP 输出压缩' },
  { name: '/prompt', syntax: '/prompt [text]', description: '输入提示词' },
  { name: '/reference', syntax: '/reference [a.png,b.png]', description: '输入参考图路径' },
  { name: '/mask', syntax: '/mask [mask.png]', description: '输入 mask 图片路径' },
  { name: '/output', syntax: '/output [dir]', description: '设置输出目录' },
  { name: '/generate', syntax: '/generate [prompt]', description: '开始生成并显示 loading' },
  { name: '/clear', syntax: '/clear', description: '清空日志' },
];

const MODEL_OPTIONS = [
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'gpt-image-1', value: 'gpt-image-1' },
];

const MODE_OPTIONS: Array<{ label: string; value: GenerationMode }> = [
  { label: '文生图 text', value: 'text' },
  { label: '图生图 image', value: 'image' },
  { label: '遮罩编辑 mask', value: 'mask' },
];

function splitPaths(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function maskSecret(value: string) {
  if (!value.trim()) {
    return '未配置';
  }

  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function optionItems(options: Array<{ label: string; value: string }>) {
  return options.map((option) => ({
    label: `${option.label} (${option.value})`,
    value: option.value,
  }));
}

export function GenerationScreen({
  config,
  configPersistenceError,
  isGenerating,
  result,
  onSaveConfig,
  onGenerate,
}: GenerationScreenProps) {
  const [panel, setPanel] = useState<Panel>('console');
  const [draftConfig, setDraftConfig] = useState(config);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<GenerationMode>('text');
  const [referenceText, setReferenceText] = useState('');
  const [mask, setMask] = useState('');
  const [messages, setMessages] = useState<string[]>(['输入 /help 查看全部指令，输入 /config 完成首次配置。']);
  const [configStep, setConfigStep] = useState<'apiKey' | 'baseURL' | 'model' | 'outputDir'>('apiKey');
  const [isConfigFlow, setIsConfigFlow] = useState(false);
  const [count, setCount] = useState(1);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
    setDraftConfig(config);
  }, [config]);

  const validationErrors = validateTerminalConfig(config);
  const hasConfigError = Object.keys(validationErrors).length > 0;

  const modelOptions = useMemo(() => {
    if (!config.model || MODEL_OPTIONS.some((option) => option.value === config.model)) {
      return MODEL_OPTIONS;
    }

    return [
      { label: `${config.model}（当前）`, value: config.model },
      ...MODEL_OPTIONS,
    ];
  }, [config.model]);

  function pushLog(message: string) {
    setMessages((current) => [...current.slice(-5), message]);
  }

  async function saveConfig(
    updater: TerminalConfig | ((current: TerminalConfig) => TerminalConfig),
    message: string,
  ) {
    const nextConfig = typeof updater === 'function'
      ? updater(configRef.current)
      : updater;

    configRef.current = nextConfig;
    setDraftConfig(nextConfig);
    const result = await onSaveConfig(nextConfig);

    if (result.ok) {
      pushLog(message);
      return;
    }

    pushLog(`配置写入失败：${result.error ?? '未知错误'}。当前会话会继续使用新配置，但重启后不会保留。`);
  }

  function openPanel(nextPanel: Panel) {
    setPanel(nextPanel);
  }

  function runGenerate(nextPrompt = prompt) {
    if (hasConfigError) {
      pushLog('配置不完整：先执行 /config，或分别执行 /apikey、/baseurl。');
      return;
    }

    if (!nextPrompt.trim()) {
      pushLog('缺少提示词：执行 /prompt 输入，或使用 /generate <prompt>。');
      openPanel('prompt');
      return;
    }

    if (mode !== 'text' && splitPaths(referenceText).length === 0) {
      pushLog('当前模式需要参考图：执行 /reference 输入本地图片路径。');
      openPanel('reference');
      return;
    }

    if (mode === 'mask' && !mask.trim()) {
      pushLog('遮罩编辑需要 mask：执行 /mask 输入 mask 图片路径。');
      openPanel('mask');
      return;
    }

    openPanel('console');
    pushLog(`开始生成：${mode} · ${config.model}`);
    onGenerate({
      prompt: nextPrompt,
      mode,
      reference: splitPaths(referenceText),
      mask: mask.trim() || undefined,
      count,
    });
  }

  function handleCommand(value: string) {
    const commandLine = value.trim();
    const [command = '', ...restParts] = commandLine.split(/\s+/);
    const rest = restParts.join(' ').trim();

    if (!commandLine) {
      return;
    }

    if (!command.startsWith('/')) {
      setPrompt(commandLine);
      pushLog('已把输入内容保存为 prompt。执行 /generate 开始生成。');
      return;
    }

    switch (command) {
      case '/help':
        openPanel('help');
        return;
      case '/config':
        setDraftConfig(config);
        setConfigStep('apiKey');
        setIsConfigFlow(true);
        openPanel('apiKey');
        pushLog('进入配置流程：API key -> baseURL -> model -> output。');
        return;
      case '/apikey':
        if (rest) {
          void saveConfig((current) => ({ ...current, apiKey: rest }), 'API key 已更新。');
          return;
        }
        setDraftConfig(config);
        setIsConfigFlow(false);
        openPanel('apiKey');
        return;
      case '/baseurl':
        if (rest) {
          void saveConfig((current) => ({ ...current, baseURL: rest }), 'baseURL 已更新。');
          return;
        }
        setDraftConfig(config);
        setIsConfigFlow(false);
        openPanel('baseURL');
        return;
      case '/proxy':
        if (rest === 'on' || rest === 'off') {
          void saveConfig((current) => ({ ...current, useProxy: rest === 'on' }), `代理已${rest === 'on' ? '开启' : '关闭'}。`);
          return;
        }
        pushLog(`当前代理：${config.useProxy ? 'on' : 'off'}。使用 /proxy on 或 /proxy off 切换。`);
        return;
      case '/mode':
        if (rest === 'text' || rest === 'image' || rest === 'mask') {
          setMode(rest);
          pushLog(`模式已切换为 ${rest}。`);
          return;
        }
        openPanel('mode');
        return;
      case '/size':
        if (rest && SIZE_OPTIONS.some((option) => option.value === rest)) {
          void saveConfig((current) => ({ ...current, defaultSize: rest }), `尺寸已切换为 ${rest}。`);
          return;
        }
        openPanel('size');
        return;
      case '/quality':
        if (rest && QUALITY_OPTIONS.some((option) => option.value === rest)) {
          void saveConfig((current) => ({ ...current, defaultQuality: rest }), `质量已切换为 ${rest}。`);
          return;
        }
        openPanel('quality');
        return;
      case '/format':
        if (rest && FORMAT_OPTIONS.some((option) => option.value === rest)) {
          void saveConfig((current) => ({ ...current, defaultOutputFormat: rest }), `输出格式已切换为 ${rest}。`);
          return;
        }
        openPanel('format');
        return;
      case '/background':
        if (rest && BACKGROUND_OPTIONS.some((option) => option.value === rest)) {
          void saveConfig((current) => ({ ...current, defaultBackground: rest }), `背景已切换为 ${rest}。`);
          return;
        }
        openPanel('background');
        return;
      case '/count':
        if (rest) {
          const nextCount = Number.parseInt(rest, 10);
          if (Number.isFinite(nextCount) && nextCount >= 1 && nextCount <= MAX_GENERATION_COUNT) {
            setCount(nextCount);
            pushLog(`本次生成张数已设置为 ${nextCount}。`);
            return;
          }

          pushLog(`张数必须在 1 到 ${MAX_GENERATION_COUNT} 之间。`);
          return;
        }
        openPanel('count');
        return;
      case '/compression':
        if (rest) {
          const compression = Number.parseInt(rest, 10);
          if (Number.isFinite(compression) && compression >= 0 && compression <= 100) {
            void saveConfig((current) => ({ ...current, defaultOutputCompression: compression }), `压缩已切换为 ${compression}。`);
            return;
          }
        }
        openPanel('compression');
        return;
      case '/prompt':
        if (rest) {
          setPrompt(rest);
          pushLog('prompt 已更新。');
          return;
        }
        openPanel('prompt');
        return;
      case '/reference':
        if (rest) {
          setReferenceText(rest);
          pushLog(`参考图已更新：${splitPaths(rest).length} 个路径。`);
          return;
        }
        openPanel('reference');
        return;
      case '/mask':
        if (rest) {
          setMask(rest);
          pushLog('mask 路径已更新。');
          return;
        }
        openPanel('mask');
        return;
      case '/output':
        if (rest) {
          void saveConfig((current) => ({ ...current, outputDir: rest }), `输出目录已更新：${rest}`);
          return;
        }
        setDraftConfig(config);
        setIsConfigFlow(false);
        openPanel('outputDir');
        return;
      case '/generate':
        if (rest) {
          setPrompt(rest);
        }
        runGenerate(rest || prompt);
        return;
      case '/clear':
        setMessages([]);
        openPanel('console');
        return;
      default:
        pushLog(`未知指令：${command}。执行 /help 查看可用指令。`);
    }
  }

  function continueConfig(nextConfig: TerminalConfig) {
    setDraftConfig(nextConfig);

    if (configStep === 'apiKey') {
      setConfigStep('baseURL');
      openPanel('baseURL');
      return;
    }

    if (configStep === 'baseURL') {
      setConfigStep('model');
      openPanel('model');
      return;
    }

    if (configStep === 'model') {
      setConfigStep('outputDir');
      openPanel('outputDir');
      return;
    }

    void saveConfig(nextConfig, '配置已保存。');
    setIsConfigFlow(false);
    openPanel('console');
  }

  function renderHelp() {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="cyan">指令</Text>
        {COMMANDS.filter((command) => command.name !== '/clear').map((command) => (
          <Box key={command.name}>
            <Box width={30}>
              <Text color="blueBright">{command.syntax}</Text>
            </Box>
            <Text color="gray">{command.description}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  function renderConfigInput() {
    if (panel === 'apiKey') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">OpenAI API key</Text>
          <Text color="gray">当前：{maskSecret(config.apiKey)}</Text>
          <PasswordInput
            placeholder="sk-..."
            onSubmit={(apiKey) => {
              const nextConfig = { ...draftConfig, apiKey: apiKey.trim() || draftConfig.apiKey };
              if (isConfigFlow) {
                continueConfig(nextConfig);
                return;
              }

              void saveConfig((current) => ({ ...current, apiKey: nextConfig.apiKey }), 'API key 已更新。');
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'baseURL') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">OpenAI baseURL</Text>
          <Text color="gray">当前：{config.baseURL}</Text>
          <TextInput
            placeholder={draftConfig.baseURL}
            defaultValue={draftConfig.baseURL}
            onSubmit={(baseURL) => {
              const nextConfig = { ...draftConfig, baseURL: baseURL.trim() || draftConfig.baseURL };
              if (isConfigFlow) {
                continueConfig(nextConfig);
                return;
              }

              void saveConfig((current) => ({ ...current, baseURL: nextConfig.baseURL }), 'baseURL 已更新。');
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'model') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">选择模型</Text>
          <ConfirmableSelect
            options={modelOptions}
            defaultValue={config.model}
            onSubmit={(model) => {
              const nextConfig = { ...draftConfig, model };
              if (isConfigFlow && configStep === 'model') {
                continueConfig(nextConfig);
              } else {
                void saveConfig((current) => ({ ...current, model }), `模型已切换为 ${model}。`);
                openPanel('console');
              }
            }}
          />
        </Box>
      );
    }

    if (panel === 'outputDir') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">输出目录</Text>
          <TextInput
            placeholder={draftConfig.outputDir}
            defaultValue={draftConfig.outputDir}
            onSubmit={(outputDir) => {
              const nextConfig = { ...draftConfig, outputDir: outputDir.trim() || draftConfig.outputDir };
              if (isConfigFlow && configStep === 'outputDir') {
                continueConfig(nextConfig);
              } else {
                void saveConfig((current) => ({ ...current, outputDir: nextConfig.outputDir }), `输出目录已更新：${nextConfig.outputDir}`);
                openPanel('console');
              }
            }}
          />
        </Box>
      );
    }

    return null;
  }

  function renderModeSelect() {
    if (panel !== 'mode') {
      return null;
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="cyan">选择生成模式</Text>
        <ConfirmableSelect
          options={MODE_OPTIONS}
          defaultValue={mode}
          onSubmit={(nextMode) => {
            setMode(nextMode as GenerationMode);
            pushLog(`模式已切换为 ${nextMode}。`);
            openPanel('console');
          }}
        />
      </Box>
    );
  }

  function renderTextInputPanel() {
    if (panel === 'prompt') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Prompt</Text>
          <TextInput
            placeholder="输入提示词后回车"
            defaultValue={prompt}
            onSubmit={(value) => {
              setPrompt(value);
              pushLog('prompt 已更新。');
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'reference') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">参考图路径</Text>
          <Text color="gray">多个路径用英文逗号分隔。</Text>
          <TextInput
            placeholder="./input/a.png, ./input/b.png"
            defaultValue={referenceText}
            onSubmit={(value) => {
              setReferenceText(value);
              pushLog(`参考图已更新：${splitPaths(value).length} 个路径。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'mask') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Mask 路径</Text>
          <TextInput
            placeholder="./input/mask.png"
            defaultValue={mask}
            onSubmit={(value) => {
              setMask(value);
              pushLog('mask 路径已更新。');
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    return null;
  }

  function renderParamPanel() {
    if (!['size', 'quality', 'format', 'background', 'count', 'compression'].includes(panel)) {
      return null;
    }

    if (panel === 'size') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">选择尺寸</Text>
          <ConfirmableSelect
            options={optionItems(SIZE_OPTIONS)}
            defaultValue={config.defaultSize}
            onSubmit={(value) => {
              void saveConfig((current) => ({ ...current, defaultSize: value }), `尺寸已切换为 ${value}。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'quality') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">选择质量</Text>
          <ConfirmableSelect
            options={optionItems(QUALITY_OPTIONS)}
            defaultValue={config.defaultQuality}
            onSubmit={(value) => {
              void saveConfig((current) => ({ ...current, defaultQuality: value }), `质量已切换为 ${value}。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'format') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">选择输出格式</Text>
          <ConfirmableSelect
            options={optionItems(FORMAT_OPTIONS)}
            defaultValue={config.defaultOutputFormat}
            onSubmit={(value) => {
              void saveConfig((current) => ({ ...current, defaultOutputFormat: value }), `输出格式已切换为 ${value}。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'background') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">选择背景</Text>
          <ConfirmableSelect
            options={optionItems(BACKGROUND_OPTIONS)}
            defaultValue={config.defaultBackground}
            onSubmit={(value) => {
              void saveConfig((current) => ({ ...current, defaultBackground: value }), `背景已切换为 ${value}。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    if (panel === 'count') {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">生成张数</Text>
          <TextInput
            placeholder="1"
            defaultValue={String(count)}
            onSubmit={(value) => {
              const count = Number.parseInt(value, 10);
              if (!Number.isFinite(count) || count < 1 || count > MAX_GENERATION_COUNT) {
                pushLog(`张数必须在 1 到 ${MAX_GENERATION_COUNT} 之间。`);
                return;
              }

              setCount(count);
              pushLog(`本次生成张数已设置为 ${count}。`);
              openPanel('console');
            }}
          />
        </Box>
      );
    }

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="cyan">输出压缩 0-100</Text>
        <TextInput
          placeholder={String(config.defaultOutputCompression)}
          defaultValue={String(config.defaultOutputCompression)}
          onSubmit={(value) => {
            const compression = Number.parseInt(value, 10);
            if (!Number.isFinite(compression) || compression < 0 || compression > 100) {
              pushLog('压缩值必须在 0 到 100 之间。');
              return;
            }

            void saveConfig((current) => ({ ...current, defaultOutputCompression: compression }), `压缩已切换为 ${compression}。`);
            openPanel('console');
          }}
        />
      </Box>
    );
  }

  const status = isGenerating ? 'loading' : result?.ok ? 'success' : result ? 'error' : 'idle';
  const message = result?.ok
    ? `生成完成：${result.outputFiles.map((file) => file.path).join(', ')}`
    : result?.message;
  const failureDetail = result && !result.ok
    ? [result.detail, result.recommendation].filter(Boolean).join('\n')
    : undefined;
  const hasTaskInput = Boolean(prompt || referenceText || mask);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="redBright" paddingX={2} paddingY={1} flexDirection="column">
        <Text>
          <Text color="redBright" bold>TokenCanvas CLI</Text>
          <Text color="gray"> v0.0.1</Text>
        </Text>
        <Box marginTop={1}>
          <Box width="50%" flexDirection="column">
            <Text bold>Welcome back!</Text>
            <Text color="gray">{config.model} · {mode} · {count} image · proxy {config.useProxy ? 'on' : 'off'}</Text>
            <Text color="gray">{config.outputDir}</Text>
          </Box>
          <Box width="50%" flexDirection="column">
            <Text color="redBright" bold>Tips</Text>
            <Text>/config 设置连接与模型</Text>
            <Text color="gray">/help 查看指令 · /generate 开始生成</Text>
          </Box>
        </Box>
        {hasConfigError ? <Text color="yellow">配置未完成：执行 /config。</Text> : null}
        {configPersistenceError ? (
          <Text color="yellow">{configPersistenceError}</Text>
        ) : null}
      </Box>

      {hasTaskInput ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">当前任务</Text>
          <Text>Prompt：{prompt || '未设置'}</Text>
          {referenceText ? <Text>参考图：{referenceText}</Text> : null}
          {mask ? <Text>Mask：{mask}</Text> : null}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <StatusPanel status={status} message={isGenerating ? '正在调用 OpenAI 生成图片...' : message} detail={failureDetail} />
      </Box>

      {messages.length ? (
        <Box flexDirection="column" marginTop={1}>
          {messages.map((line, index) => <Text key={`${line}-${index}`} color="gray">› {line}</Text>)}
        </Box>
      ) : null}

      {panel === 'help' ? renderHelp() : null}
      {renderConfigInput()}
      {renderModeSelect()}
      {renderTextInputPanel()}
      {renderParamPanel()}

      {panel === 'console' || panel === 'help' ? (
        <Box marginTop={1}>
          <CommandInput
            commands={COMMANDS}
            onSubmit={handleCommand}
            isDisabled={isGenerating}
          />
        </Box>
      ) : null}
    </Box>
  );
}
