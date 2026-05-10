import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';
import type { SavedImageFile } from '../../lib/openai/node-image-output';
import { resolveTerminalConfigDir } from '../config/terminal-config-store';

const HISTORY_FILE_NAME = 'history.json';
const HISTORY_LOCK_FILE_NAME = 'history.json.lock';
const HISTORY_TEMP_FILE_NAME = 'history.json.tmp';
const HISTORY_LOCK_POLL_MS = 20;
const HISTORY_LOCK_TIMEOUT_MS = 1_500;

export interface TerminalHistoryEntry {
  id: string;
  modelId: string;
  prompt: string;
  mode: GenerationMode;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  outputFiles: SavedImageFile[];
  createdAt: string;
}

function createHistoryId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `terminal-history-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTerminalHistoryEntry(
  input: Omit<TerminalHistoryEntry, 'id' | 'createdAt'>,
): TerminalHistoryEntry {
  return {
    id: createHistoryId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function trimTerminalHistory(entries: TerminalHistoryEntry[], limit: number) {
  return [...entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(limit, 1));
}

function historyPath(configDir = resolveTerminalConfigDir()) {
  return join(configDir, HISTORY_FILE_NAME);
}

function historyLockPath(configDir = resolveTerminalConfigDir()) {
  return join(configDir, HISTORY_LOCK_FILE_NAME);
}

function historyTempPath(configDir = resolveTerminalConfigDir()) {
  return join(configDir, HISTORY_TEMP_FILE_NAME);
}

export async function loadTerminalHistory(configDir = resolveTerminalConfigDir()) {
  try {
    const raw = await readFile(historyPath(configDir), 'utf8');
    const entries = JSON.parse(raw) as TerminalHistoryEntry[];
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    return [];
  }
}

export async function saveTerminalHistory(
  entries: TerminalHistoryEntry[],
  configDir = resolveTerminalConfigDir(),
) {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const targetPath = historyPath(configDir);
  const temporaryPath = historyTempPath(configDir);

  try {
    await writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function acquireHistoryLock(configDir: string, timeoutMs = HISTORY_LOCK_TIMEOUT_MS) {
  const lockPath = historyLockPath(configDir);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      return await open(lockPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      if (Date.now() >= deadline) {
        throw new Error('终端历史记录暂时被占用，稍后重试。');
      }

      await new Promise((resolve) => setTimeout(resolve, HISTORY_LOCK_POLL_MS));
    }
  }
}

export async function prependTerminalHistoryEntry(
  entry: TerminalHistoryEntry,
  options: { configDir?: string; limit: number; lockTimeoutMs?: number },
) {
  const configDir = options.configDir ?? resolveTerminalConfigDir();
  const lockHandle = await acquireHistoryLock(configDir, options.lockTimeoutMs);

  try {
    const entries = await loadTerminalHistory(configDir);
    const nextEntries = trimTerminalHistory([
      entry,
      ...entries.filter((item) => item.id !== entry.id),
    ], options.limit);

    await saveTerminalHistory(nextEntries, configDir);
    return nextEntries;
  } finally {
    await lockHandle.close();
    await rm(historyLockPath(configDir), { force: true });
  }
}
