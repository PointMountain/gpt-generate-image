import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { renderPreview } from './preview-renderer';

describe('preview-renderer', () => {
  it('falls back to an output path when preview is unsupported', () => {
    expect(renderPreview('/tmp/image.png', { supported: false, protocol: 'none' })).toEqual({
      ok: false,
      output: '图片已保存：/tmp/image.png',
      protocol: 'none',
    });
  });

  it('renders an iTerm2 inline image escape when supported', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-preview-test-'));
    const filePath = join(outputDir, 'image.png');
    await writeFile(filePath, 'preview');

    expect(renderPreview(filePath, { supported: true, protocol: 'iterm2' }).output)
      .toContain(']1337;File=');
  });

  it('falls back to a stale-file message when preview source is missing', () => {
    expect(renderPreview('/tmp/missing-preview-file.png', { supported: true, protocol: 'iterm2' })).toMatchObject({
      ok: false,
      output: '历史文件不存在：/tmp/missing-preview-file.png',
    });
  });
});
