import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { TerminalHistoryEntry } from '../../history/terminal-history-store';
import { detectPreviewCapability } from '../../preview/preview-capability';
import { renderPreview } from '../../preview/preview-renderer';
import { ConfirmableSelect } from '../components/confirmable-select';

interface HistoryScreenProps {
  entries: TerminalHistoryEntry[];
  onClose?: () => void;
  onOpen?: (entry: TerminalHistoryEntry) => void | Promise<void>;
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(limit - 1, 1))}…`;
}

function historyOptionLabel(entry: TerminalHistoryEntry) {
  return truncateText(`${entry.prompt} · ${entry.modelId}`, 30);
}

export function HistoryScreen({ entries, onClose, onOpen }: HistoryScreenProps) {
  const capability = detectPreviewCapability();
  const [activeEntryId, setActiveEntryId] = useState(entries[0]?.id ?? '');

  useEffect(() => {
    setActiveEntryId((current) => {
      if (entries.some((entry) => entry.id === current)) {
        return current;
      }

      return entries[0]?.id ?? '';
    });
  }, [entries]);

  useInput((_input, key) => {
    if (key.escape) {
      onClose?.();
    }
  }, { isActive: Boolean(onClose) });

  const options = useMemo(() => {
    return entries.map((entry) => ({
      label: historyOptionLabel(entry),
      value: entry.id,
    }));
  }, [entries]);

  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? entries[0];
  const firstFile = activeEntry?.outputFiles[0];
  const preview = firstFile ? renderPreview(firstFile.path, capability) : null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>最近结果</Text>
      <Text color="gray">↑/↓ 选择，Enter 打开图片，Esc 返回命令台。</Text>

      {entries.length === 0 ? (
        <Text color="gray">暂无终端生成历史。</Text>
      ) : (
        <>
          <Box marginTop={1}>
            <ConfirmableSelect
              options={options}
              value={activeEntry?.id}
              visibleOptionCount={5}
              onHighlightChange={(value) => {
                setActiveEntryId(value);
              }}
              onSubmit={(value) => {
                const entry = entries.find((item) => item.id === value);
                if (entry) {
                  void onOpen?.(entry);
                }
              }}
            />
          </Box>

          {activeEntry ? (
            <Box flexDirection="column" marginTop={1}>
              <Text>{activeEntry.prompt}</Text>
              <Text color="gray">
                {activeEntry.modelId} · {activeEntry.mode} · {activeEntry.createdAt}
              </Text>
              {activeEntry.outputFiles.map((file, index) => (
                <Text key={file.path}>
                  {index === 0 ? '输出：' : '附加输出：'}
                  {file.path}
                </Text>
              ))}
              {preview ? <Text>{preview.output}</Text> : null}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
