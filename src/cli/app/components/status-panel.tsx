import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

interface StatusPanelProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  detail?: string;
}

export function StatusPanel({ status, message, detail }: StatusPanelProps) {
  if (status === 'loading') {
    return <Text color="yellow">› {message ?? '生成中，请等待...'}</Text>;
  }

  if (status === 'success') {
    return (
      <StatusMessage variant="success">
        {message ?? '完成'}
      </StatusMessage>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <StatusMessage variant="error">
          {message ?? '失败'}
        </StatusMessage>
        {detail ? <Text color="gray">{detail}</Text> : null}
      </Box>
    );
  }

  return <Text color="gray">{message ?? '准备就绪'}</Text>;
}
