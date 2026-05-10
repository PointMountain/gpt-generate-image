import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTerminalHistoryEntry, prependTerminalHistoryEntry, trimTerminalHistory } from './terminal-history-store';

const tempDirs: string[] = [];

describe('terminal-history-store', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async (dir) => {
      await import('node:fs/promises').then(({ rm }) => rm(dir, { recursive: true, force: true }));
    }));
  });

  it('keeps the newest terminal history entries within the retention limit', () => {
    const older = createTerminalHistoryEntry({
      modelId: 'gpt-image-1',
      prompt: 'older',
      mode: 'text',
      size: '1024x1024',
      count: 1,
      quality: 'auto',
      outputFormat: 'png',
      background: 'auto',
      outputCompression: 0,
      outputFiles: [],
    });
    const newer = { ...older, id: 'newer', prompt: 'newer', createdAt: '2099-01-01T00:00:00.000Z' };

    expect(trimTerminalHistory([older, newer], 1)).toEqual([newer]);
  });

  it('times out when the terminal history lock is stuck', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'tokencanvas-history-'));
    tempDirs.push(configDir);
    await writeFile(join(configDir, 'history.json.lock'), '');

    await expect(prependTerminalHistoryEntry(createTerminalHistoryEntry({
      modelId: 'gpt-image-1',
      prompt: 'blocked',
      mode: 'text',
      size: '1024x1024',
      count: 1,
      quality: 'auto',
      outputFormat: 'png',
      background: 'auto',
      outputCompression: 0,
      outputFiles: [],
    }), {
      configDir,
      limit: 10,
      lockTimeoutMs: 25,
    })).rejects.toThrow('终端历史记录暂时被占用');
  });
});
