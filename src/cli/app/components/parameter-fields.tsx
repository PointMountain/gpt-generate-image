import React from 'react';
import { Box, Text } from 'ink';
import type { TerminalConfig } from '../../config/terminal-config-store';

export function ParameterFields({ config }: { config: TerminalConfig }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan">默认参数</Text>
      <Text>模型：{config.model}</Text>
      <Text>尺寸：{config.defaultSize} · 质量：{config.defaultQuality} · 格式：{config.defaultOutputFormat}</Text>
      <Text>背景：{config.defaultBackground} · 压缩：{config.defaultOutputCompression}</Text>
    </Box>
  );
}
