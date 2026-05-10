import { mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { NormalizedImageResult } from './response-normalizer';
import { createProxyAwareFetch } from './proxy-aware-fetch';

export interface SavedImageFile {
  imageId: string;
  path: string;
  mimeType: string;
}

interface SaveGeneratedImagesOptions {
  outputDir: string;
  outputFormat: string;
  useProxy?: boolean;
  basename?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function extensionForImage(image: NormalizedImageResult, outputFormat: string) {
  if (image.extension) {
    return image.extension === 'jpeg' ? 'jpg' : image.extension;
  }

  if (image.mimeType?.includes('/')) {
    const extension = image.mimeType.split('/')[1] ?? 'png';
    return extension === 'jpeg' ? 'jpg' : extension;
  }

  return outputFormat !== 'auto' ? outputFormat : 'png';
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    return undefined;
  }

  return {
    mimeType: match[1] ?? 'image/png',
    bytes: Buffer.from(match[2] ?? '', 'base64'),
  };
}

async function reserveAvailableFile(outputDir: string, basename: string, extension: string, index: number) {
  const baseName = `${basename}-${String(index + 1).padStart(2, '0')}`;
  let candidate = join(outputDir, `${baseName}.${extension}`);
  let suffix = 1;

  while (true) {
    try {
      const handle = await open(candidate, 'wx', 0o600);
      return {
        path: candidate,
        handle,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      candidate = join(outputDir, `${baseName}-${suffix}.${extension}`);
      suffix += 1;
    }
  }
}

function createDownloadTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(timeoutMs, 1));

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

export async function saveGeneratedImages(
  images: NormalizedImageResult[],
  options: SaveGeneratedImagesOptions,
): Promise<SavedImageFile[]> {
  const fetcher = createProxyAwareFetch(options.useProxy ?? false, options.fetcher ?? fetch);
  const basename = options.basename ?? 'tokencanvas';
  await mkdir(options.outputDir, { recursive: true });

  const savedFiles: SavedImageFile[] = [];

  for (const [index, image] of images.entries()) {
    const extension = extensionForImage(image, options.outputFormat);
    const reserved = await reserveAvailableFile(options.outputDir, basename, extension, index);

    try {
      if (image.source === 'url') {
        const timeout = createDownloadTimeout(options.timeoutMs ?? 30_000);

        try {
          const response = await fetcher(image.src, {
            signal: timeout.signal,
          });
          if (!response.ok) {
            throw new Error(`下载生成图片失败：${response.status}`);
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          await reserved.handle.writeFile(bytes);
          savedFiles.push({
            imageId: image.id,
            path: reserved.path,
            mimeType: response.headers.get('content-type') ?? image.mimeType ?? 'image/png',
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('下载生成图片超时。');
          }

          throw error;
        } finally {
          timeout.cleanup();
        }
      } else {
        const parsed = parseDataUrl(image.src);
        if (!parsed) {
          throw new Error('生成结果不是可写入的 base64 图片。');
        }

        await reserved.handle.writeFile(parsed.bytes);
        savedFiles.push({
          imageId: image.id,
          path: reserved.path,
          mimeType: parsed.mimeType,
        });
      }
    } catch (error) {
      await reserved.handle.close();
      await rm(reserved.path, { force: true });
      throw error;
    }
    await reserved.handle.close();
  }

  return savedFiles;
}
