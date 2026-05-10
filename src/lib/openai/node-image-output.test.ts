import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { saveGeneratedImages } from './node-image-output';

describe('node-image-output', () => {
  it('writes generated base64 images to non-destructive output paths', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-output-test-'));
    await writeFile(join(outputDir, 'tokencanvas-01.png'), 'existing');

    const saved = await saveGeneratedImages([
      {
        id: 'image-1',
        source: 'base64',
        src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
        extension: 'png',
      },
    ], {
      outputDir,
      outputFormat: 'png',
    });

    expect(saved[0]?.path).toContain('tokencanvas-01-1.png');
    await expect(readFile(saved[0]!.path, 'utf8')).resolves.toBe('fake-image');
  });

  it('downloads URL-based images with the configured proxy preference', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-output-url-test-'));
    const fetcher = vi.fn(async () => {
      expect(process.env.HTTPS_PROXY).toBeUndefined();
      return new Response('url-image', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });

    const saved = await saveGeneratedImages([{
      id: 'image-2',
      source: 'url',
      src: 'https://example.com/generated.png',
      mimeType: 'image/png',
      extension: 'png',
    }], {
      outputDir,
      outputFormat: 'png',
      useProxy: false,
      fetcher: fetcher as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledWith('https://example.com/generated.png', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    await expect(readFile(saved[0]!.path, 'utf8')).resolves.toBe('url-image');
    expect(process.env.HTTPS_PROXY).toBe('http://proxy.local:8080');
    delete process.env.HTTPS_PROXY;
  });

  it('reserves unique output paths for concurrent writes', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-output-race-test-'));

    const [first, second] = await Promise.all([
      saveGeneratedImages([{
        id: 'image-1',
        source: 'base64',
        src: 'data:image/png;base64,Zmlyc3Q=',
        mimeType: 'image/png',
        extension: 'png',
      }], {
        outputDir,
        outputFormat: 'png',
      }),
      saveGeneratedImages([{
        id: 'image-2',
        source: 'base64',
        src: 'data:image/png;base64,c2Vjb25k',
        mimeType: 'image/png',
        extension: 'png',
      }], {
        outputDir,
        outputFormat: 'png',
      }),
    ]);

    expect(first[0]?.path).not.toBe(second[0]?.path);
  });
});
