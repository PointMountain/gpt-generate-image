import React from 'react';
import { Box, Text } from 'ink';
import type { TerminalHistoryEntry } from '../../history/terminal-history-store';
import { detectPreviewCapability } from '../../preview/preview-capability';
import { renderPreview } from '../../preview/preview-renderer';

export function HistoryScreen({ entries }: { entries: TerminalHistoryEntry[] }) {
  const capability = detectPreviewCapability();

  return (
    <Box flexDirection="column">
      <Text bold>最近结果</Text>
      {entries.length === 0 ? <Text color="gray">暂无终端生成历史。</Text> : null}
      {entries.map((entry) => {
        const firstFile = entry.outputFiles[0];
        const preview = firstFile ? renderPreview(firstFile.path, capability) : null;

        return (
          <Box key={entry.id} flexDirection="column" marginTop={1}>
            <Text>{entry.prompt}</Text>
            <Text color="gray">{entry.modelId} · {entry.mode} · {entry.createdAt}</Text>
            {entry.outputFiles.map((file) => <Text key={file.path}>输出：{file.path}</Text>)}
            {preview ? <Text>{preview.output}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
