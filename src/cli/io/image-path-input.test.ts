import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { readReferenceImagesFromPaths, mimeTypeForPath, readImageInputFromPath, readReferenceImageFromPath } from './image-path-input';

describe('image-path-input', () => {
  it('detects common image MIME types from paths', () => {
    expect(mimeTypeForPath('a.png')).toBe('image/png');
    expect(mimeTypeForPath('a.jpeg')).toBe('image/jpeg');
    expect(mimeTypeForPath('a.unknown')).toBe('application/octet-stream');
  });

  it('reads image bytes from a filesystem path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokencanvas-input-test-'));
    const filePath = join(dir, 'reference.png');
    await writeFile(filePath, 'fake-image');

    const input = await readImageInputFromPath(filePath);
    const reference = await readReferenceImageFromPath(filePath);

    expect(input.name).toBe('reference.png');
    expect(input.type).toBe('image/png');
    expect(reference.previewUrl).toMatch(/^file:/);
  });

  it('rejects oversized images before reading them into memory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokencanvas-input-limit-test-'));
    const filePath = join(dir, 'large.png');
    await writeFile(filePath, Buffer.alloc(11 * 1024 * 1024));

    await expect(readImageInputFromPath(filePath)).rejects.toThrow(/超过 10MB/);
  });

  it('rejects oversized reference batches before loading all files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokencanvas-input-total-limit-test-'));
    const files = await Promise.all(Array.from({ length: 5 }).map(async (_, index) => {
      const filePath = join(dir, `reference-${index}.png`);
      await writeFile(filePath, Buffer.alloc(9 * 1024 * 1024));
      return filePath;
    }));

    await expect(readReferenceImagesFromPaths(files)).rejects.toThrow(/总大小超过 40MB/);
  });
});
