import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createImageInputFromBytes,
  type ImageReferenceInput,
  type ImageBinaryInput,
} from '../../lib/openai/image-file-adapter';
import {
  MAX_IMAGE_FILE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
} from '../../lib/openai/ai-sdk-image-client';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function mimeTypeForPath(filePath: string) {
  return MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export async function readImageInputFromPath(filePath: string): Promise<ImageBinaryInput> {
  const absolutePath = resolve(filePath);
  const fileStat = await stat(absolutePath);

  if (!fileStat.isFile()) {
    throw new Error(`${filePath} 不是可读取的图片文件。`);
  }

  if (fileStat.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error(`${basename(absolutePath)} 超过 ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)}MB。`);
  }

  const bytes = await readFile(absolutePath);

  return createImageInputFromBytes({
    bytes,
    name: basename(absolutePath),
    type: mimeTypeForPath(absolutePath),
  });
}

export async function readReferenceImageFromPath(filePath: string): Promise<ImageReferenceInput> {
  const absolutePath = resolve(filePath);

  return {
    file: await readImageInputFromPath(absolutePath),
    previewUrl: pathToFileURL(absolutePath).toString(),
  };
}

export async function readReferenceImagesFromPaths(paths: string[]) {
  const fileStats = await Promise.all(paths.map(async (filePath) => {
    const absolutePath = resolve(filePath);
    const fileStat = await stat(absolutePath);

    if (!fileStat.isFile()) {
      throw new Error(`${filePath} 不是可读取的图片文件。`);
    }

    if (fileStat.size > MAX_IMAGE_FILE_BYTES) {
      throw new Error(`${basename(absolutePath)} 超过 ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)}MB。`);
    }

    return fileStat.size;
  }));

  const totalBytes = fileStats.reduce((sum, size) => sum + size, 0);
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    throw new Error(`参考图总大小超过 ${Math.round(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024)}MB。`);
  }

  return Promise.all(paths.map((path) => readReferenceImageFromPath(path)));
}
