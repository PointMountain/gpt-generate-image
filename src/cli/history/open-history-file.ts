import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface OpenHistoryFileResult {
  ok: boolean;
  path: string;
  detail: string;
}

export interface OpenHistoryFileDeps {
  accessImpl?: typeof access;
  execFileImpl?: typeof execFileAsync;
  platform?: NodeJS.Platform;
}

function openerFor(platform: NodeJS.Platform) {
  if (platform === 'darwin') {
    return { command: 'open', args: [] as string[] };
  }

  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', ''] as string[] };
  }

  return { command: 'xdg-open', args: [] as string[] };
}

export async function openHistoryFile(
  filePath: string,
  deps: OpenHistoryFileDeps = {},
): Promise<OpenHistoryFileResult> {
  const accessImpl = deps.accessImpl ?? access;
  const execImpl = deps.execFileImpl ?? execFileAsync;
  const platform = deps.platform ?? process.platform;

  try {
    await accessImpl(filePath, constants.F_OK);
  } catch {
    return {
      ok: false,
      path: filePath,
      detail: `历史文件不存在：${filePath}`,
    };
  }

  const opener = openerFor(platform);
  const args = platform === 'win32'
    ? ['/c', 'start', '', filePath]
    : [...opener.args, filePath];

  try {
    await execImpl(opener.command, args);
    return {
      ok: true,
      path: filePath,
      detail: `已打开历史图片：${filePath}`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      path: filePath,
      detail: `自动打开失败：${detail}。请手动打开 ${filePath}`,
    };
  }
}
