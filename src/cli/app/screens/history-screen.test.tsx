import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { HistoryScreen } from './history-screen';

async function waitForInput() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const entries = [
  {
    id: 'history-1',
    modelId: 'gpt-image-1',
    prompt: 'warm portrait',
    mode: 'text' as const,
    size: '1024x1024',
    count: 1,
    quality: 'auto',
    outputFormat: 'png',
    background: 'auto',
    outputCompression: 0,
    outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
    createdAt: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'history-2',
    modelId: 'gpt-image-2',
    prompt: 'city skyline at night with reflections',
    mode: 'text' as const,
    size: '1024x1024',
    count: 1,
    quality: 'auto',
    outputFormat: 'png',
    background: 'auto',
    outputCompression: 0,
    outputFiles: [{ imageId: 'image-2', path: '/tmp/out-2.png', mimeType: 'image/png' }],
    createdAt: '2026-05-10T01:00:00.000Z',
  },
];

describe('HistoryScreen', () => {
  it('renders a compact empty state', () => {
    const { lastFrame } = render(<HistoryScreen entries={[]} />);

    expect(lastFrame()).toContain('暂无终端生成历史');
    expect(lastFrame()).toContain('Esc 返回命令台');
  });

  it('shows only the selected entry detail instead of dumping all history previews', () => {
    const { lastFrame } = render(<HistoryScreen entries={entries} />);

    expect(lastFrame()).toContain('warm portrait');
    expect(lastFrame()).toContain('/tmp/out.png');
    expect(lastFrame()).not.toContain('/tmp/out-2.png');
  });

  it('submits the highlighted history entry on enter', async () => {
    const onOpen = vi.fn();
    const { stdin } = render(<HistoryScreen entries={entries} onOpen={onOpen} />);

    await waitForInput();
    stdin.write('\u001B[B');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(onOpen).toHaveBeenCalledWith(entries[1]);
  });

  it('updates detail content when the highlighted history item changes', async () => {
    const { stdin, lastFrame } = render(<HistoryScreen entries={entries} />);

    await waitForInput();
    stdin.write('\u001B[B');
    await waitForInput();

    expect(lastFrame()).toContain('city skyline at night with reflections');
    expect(lastFrame()).toContain('/tmp/out-2.png');
    expect(lastFrame()).not.toContain('/tmp/out.png');
  });

  it('keeps selection coherent when entries refresh while the panel is open', () => {
    const refreshedEntries = [{
      ...entries[1],
      id: 'history-3',
      prompt: 'refreshed history item',
      outputFiles: [{ imageId: 'image-3', path: '/tmp/refreshed.png', mimeType: 'image/png' }],
    }];
    const { lastFrame, rerender } = render(<HistoryScreen entries={entries} />);

    rerender(<HistoryScreen entries={refreshedEntries} />);

    expect(lastFrame()).toContain('refreshed history item');
    expect(lastFrame()).toContain('/tmp/refreshed.png');
  });

  it('closes on escape when requested', async () => {
    const onClose = vi.fn();
    const { stdin } = render(<HistoryScreen entries={entries} onClose={onClose} />);

    await waitForInput();
    stdin.write('\u001B');
    await waitForInput();

    expect(onClose).toHaveBeenCalled();
  });
});
