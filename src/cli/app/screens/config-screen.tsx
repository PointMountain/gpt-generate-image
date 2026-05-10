import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { PasswordInput, TextInput } from '@inkjs/ui';
import {
  createDefaultTerminalConfig,
  type TerminalConfig,
} from '../../config/terminal-config-store';

interface ConfigScreenProps {
  initialConfig?: TerminalConfig;
  onSave: (config: TerminalConfig) => void;
}

type Step = 'apiKey' | 'baseURL' | 'model' | 'outputDir' | 'done';

export function ConfigScreen({ initialConfig = createDefaultTerminalConfig(), onSave }: ConfigScreenProps) {
  const [draft, setDraft] = useState(initialConfig);
  const [step, setStep] = useState<Step>('apiKey');

  function save(nextDraft: TerminalConfig) {
    setStep('done');
    onSave(nextDraft);
  }

  return (
    <Box flexDirection="column">
      <Text bold>TokenCanvas 终端配置</Text>
      <Text color="gray">配置只写入终端本地文件，不读取浏览器 localStorage/IndexedDB。</Text>

      {step === 'apiKey' ? (
        <PasswordInput
          placeholder="OpenAI API key"
          onSubmit={(apiKey) => {
            setDraft({ ...draft, apiKey });
            setStep('baseURL');
          }}
        />
      ) : null}

      {step === 'baseURL' ? (
        <TextInput
          placeholder={draft.baseURL}
          onSubmit={(baseURL) => {
            setDraft({ ...draft, baseURL: baseURL.trim() || draft.baseURL });
            setStep('model');
          }}
        />
      ) : null}

      {step === 'model' ? (
        <TextInput
          placeholder={draft.model}
          onSubmit={(model) => {
            setDraft({ ...draft, model: model.trim() || draft.model });
            setStep('outputDir');
          }}
        />
      ) : null}

      {step === 'outputDir' ? (
        <TextInput
          placeholder={draft.outputDir}
          onSubmit={(outputDir) => save({ ...draft, outputDir: outputDir.trim() || draft.outputDir })}
        />
      ) : null}

      {step === 'done' ? <Text color="green">配置已保存。</Text> : null}
    </Box>
  );
}
