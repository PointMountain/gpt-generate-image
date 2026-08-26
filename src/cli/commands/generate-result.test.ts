import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTerminalConfig } from '../config/terminal-config-store';
import { formatGenerateCommandResult, runGenerateCommand } from './generate-result';

describe('generate-result', () => {
  it('runs a text generation command and returns saved output paths', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-test-'));
    const result = await runGenerateCommand({
      prompt: 'warm portrait',
      outputDir,
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
      })),
      generateImages: vi.fn().mockResolvedValue({
        ok: true,
        images: [{
          id: 'image-1',
          source: 'base64',
          src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
          mimeType: 'image/png',
          extension: 'png',
        }],
      }),
      saveHistory: vi.fn().mockResolvedValue([]),
    });

    expect(result).toMatchObject({
      ok: true,
      mode: 'text',
      model: 'gpt-image-2',
    });
    if (result.ok) {
      expect(result.outputFiles[0]?.path).toContain(outputDir);
    }
  });

  it('returns config errors before generation starts', async () => {
    const generateImages = vi.fn();
    const result = await runGenerateCommand({
      prompt: 'warm portrait',
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig()),
      generateImages,
    });

    expect(result).toMatchObject({
      ok: false,
      message: 'OpenAI API key 不能为空。',
    });
    expect(generateImages).not.toHaveBeenCalled();
  });

  it('allows a command run to override proxy usage', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-proxy-test-'));
    const generateImages = vi.fn().mockResolvedValue({
      ok: true,
      images: [{
        id: 'image-1',
        source: 'base64',
        src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
        extension: 'png',
      }],
    });

    await runGenerateCommand({
      prompt: 'warm portrait',
      outputDir,
      proxy: 'on',
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
        useProxy: false,
      })),
      generateImages,
      saveHistory: vi.fn().mockResolvedValue([]),
    });

    expect(generateImages.mock.calls[0]?.[0]).toMatchObject({
      useProxy: true,
    });
  });

  it('passes the resolved proxy preference to image saving for URL-based outputs', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-save-proxy-test-'));
    const saveImages = vi.fn().mockResolvedValue([
      { imageId: 'image-1', path: join(outputDir, 'out.png'), mimeType: 'image/png' },
    ]);

    await runGenerateCommand({
      prompt: 'warm portrait',
      outputDir,
      proxy: 'off',
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
        useProxy: true,
      })),
      generateImages: vi.fn().mockResolvedValue({
        ok: true,
        images: [{
          id: 'image-1',
          source: 'url',
          src: 'https://example.com/generated.png',
          mimeType: 'image/png',
          extension: 'png',
        }],
      }),
      saveImages,
      saveHistory: vi.fn().mockResolvedValue([]),
    });

    expect(saveImages.mock.calls[0]?.[1]).toMatchObject({
      useProxy: false,
    });
  });

  it('formats JSON output for automation', () => {
    const output = formatGenerateCommandResult({
      ok: true,
      mode: 'text',
      model: 'gpt-image-1',
      outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
    }, true);

    expect(JSON.parse(output)).toMatchObject({
      ok: true,
      outputFiles: [{ path: '/tmp/out.png' }],
    });
  });

  it('infers image mode from reference inputs when mode is omitted', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-infer-mode-test-'));
    const referencePath = join(outputDir, 'reference.png');
    await writeFile(referencePath, 'fake-image');
    const generateImages = vi.fn().mockResolvedValue({
      ok: true,
      images: [{
        id: 'image-1',
        source: 'base64',
        src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
        mimeType: 'image/png',
        extension: 'png',
      }],
    });

    const result = await runGenerateCommand({
      prompt: 'edit this',
      outputDir,
      reference: [referencePath],
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
      })),
      generateImages,
      saveHistory: vi.fn().mockResolvedValue([]),
    });

    expect(result).toMatchObject({
      ok: true,
      mode: 'image',
    });
    expect(generateImages.mock.calls[0]?.[1]).toMatchObject({
      mode: 'image',
    });
  });

  it('returns success with a warning when history persistence fails after files are written', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-history-warning-test-'));
    const result = await runGenerateCommand({
      prompt: 'warm portrait',
      outputDir,
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
      })),
      generateImages: vi.fn().mockResolvedValue({
        ok: true,
        images: [{
          id: 'image-1',
          source: 'base64',
          src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
          mimeType: 'image/png',
          extension: 'png',
        }],
      }),
      saveHistory: vi.fn().mockRejectedValue(new Error('history locked')),
    });

    expect(result).toMatchObject({
      ok: true,
      warning: expect.stringContaining('history locked'),
    });
  });

  it('does not preload reference files during explicit text mode runs', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tokencanvas-generate-text-mode-test-'));
    const result = await runGenerateCommand({
      prompt: 'warm portrait',
      mode: 'text',
      outputDir,
      reference: ['/path/that/does/not/exist.png'],
    }, {
      loadConfig: vi.fn().mockResolvedValue(createDefaultTerminalConfig({
        apiKey: 'sk-test',
        outputDir,
      })),
      generateImages: vi.fn().mockResolvedValue({
        ok: true,
        images: [{
          id: 'image-1',
          source: 'base64',
          src: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
          mimeType: 'image/png',
          extension: 'png',
        }],
      }),
      saveHistory: vi.fn().mockResolvedValue([]),
    });

    expect(result).toMatchObject({
      ok: true,
      mode: 'text',
    });
  });
});
