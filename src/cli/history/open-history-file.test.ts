import { describe, expect, it, vi } from 'vitest';
import { openHistoryFile } from './open-history-file';

describe('openHistoryFile', () => {
  it('opens an existing file with the platform opener', async () => {
    const accessImpl = vi.fn().mockResolvedValue(undefined);
    const execFileImpl = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });

    const result = await openHistoryFile('/tmp/out.png', {
      accessImpl,
      execFileImpl,
      platform: 'darwin',
    });

    expect(result).toEqual({
      ok: true,
      path: '/tmp/out.png',
      detail: '已打开历史图片：/tmp/out.png',
    });
    expect(execFileImpl).toHaveBeenCalledWith('open', ['/tmp/out.png']);
  });

  it('returns a stale-file message when the target is missing', async () => {
    const accessImpl = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const execFileImpl = vi.fn();

    const result = await openHistoryFile('/tmp/missing.png', {
      accessImpl,
      execFileImpl,
      platform: 'darwin',
    });

    expect(result).toEqual({
      ok: false,
      path: '/tmp/missing.png',
      detail: '历史文件不存在：/tmp/missing.png',
    });
    expect(execFileImpl).not.toHaveBeenCalled();
  });

  it('uses the Windows opener contract on win32', async () => {
    const accessImpl = vi.fn().mockResolvedValue(undefined);
    const execFileImpl = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });

    const result = await openHistoryFile('C:\\tmp\\out.png', {
      accessImpl,
      execFileImpl,
      platform: 'win32',
    });

    expect(result).toEqual({
      ok: true,
      path: 'C:\\tmp\\out.png',
      detail: '已打开历史图片：C:\\tmp\\out.png',
    });
    expect(execFileImpl).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'C:\\tmp\\out.png']);
  });

  it('returns a recoverable fallback when the opener fails', async () => {
    const accessImpl = vi.fn().mockResolvedValue(undefined);
    const execFileImpl = vi.fn().mockRejectedValue(new Error('open command failed'));

    const result = await openHistoryFile('/tmp/out.png', {
      accessImpl,
      execFileImpl,
      platform: 'linux',
    });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('自动打开失败：open command failed');
    expect(result.detail).toContain('/tmp/out.png');
    expect(execFileImpl).toHaveBeenCalledWith('xdg-open', ['/tmp/out.png']);
  });
});
