import type { NormalizedImageResult } from './response-normalizer';

interface BrowserOutputOptions {
  size: string;
  outputFormat: string;
  outputCompression: number;
  background: string;
}

function parseRequestedSize(size: string) {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return undefined;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function requestedMimeType(outputFormat: string, fallback = 'image/png') {
  if (outputFormat === 'jpeg') {
    return 'image/jpeg';
  }
  if (outputFormat === 'png' || outputFormat === 'webp') {
    return `image/${outputFormat}`;
  }
  return fallback;
}

function canvasQuality(outputFormat: string, outputCompression: number) {
  if (!['jpeg', 'webp'].includes(outputFormat) || outputCompression <= 0) {
    return undefined;
  }

  return Math.max(0.01, Math.min(1, 1 - outputCompression / 100));
}

function ratiosMatch(
  actualWidth: number,
  actualHeight: number,
  requestedWidth: number,
  requestedHeight: number,
) {
  return Math.abs(actualWidth / actualHeight - requestedWidth / requestedHeight) < 0.01;
}

async function normalizeImage(
  image: NormalizedImageResult,
  options: BrowserOutputOptions,
): Promise<NormalizedImageResult> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return image;
  }

  try {
    const response = await fetch(image.src);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const actual = { width: bitmap.width, height: bitmap.height };
    const requested = parseRequestedSize(options.size);

    if (!requested || (actual.width === requested.width && actual.height === requested.height)) {
      bitmap.close();
      return {
        ...image,
        ...actual,
        dimensionStatus: 'matched',
      };
    }

    const sameRatio = ratiosMatch(actual.width, actual.height, requested.width, requested.height);

    const canvas = document.createElement('canvas');
    canvas.width = requested.width;
    canvas.height = requested.height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return image;
    }

    if (sameRatio) {
      context.drawImage(bitmap, 0, 0, requested.width, requested.height);
    } else {
      const scale = Math.min(requested.width / actual.width, requested.height / actual.height);
      const width = Math.round(actual.width * scale);
      const height = Math.round(actual.height * scale);
      const x = Math.round((requested.width - width) / 2);
      const y = Math.round((requested.height - height) / 2);
      if (options.background === 'transparent') {
        context.clearRect(0, 0, requested.width, requested.height);
      } else {
        context.fillStyle = '#f3ead8';
        context.fillRect(0, 0, requested.width, requested.height);
        const coverScale = Math.max(requested.width / actual.width, requested.height / actual.height) * 1.08;
        const coverWidth = Math.round(actual.width * coverScale);
        const coverHeight = Math.round(actual.height * coverScale);
        context.save();
        context.globalAlpha = 0.32;
        context.filter = 'blur(32px) saturate(0.8)';
        context.drawImage(
          bitmap,
          Math.round((requested.width - coverWidth) / 2),
          Math.round((requested.height - coverHeight) / 2),
          coverWidth,
          coverHeight,
        );
        context.restore();
      }
      context.drawImage(bitmap, x, y, width, height);
    }
    bitmap.close();
    const mimeType = requestedMimeType(options.outputFormat, image.mimeType ?? blob.type);
    const quality = canvasQuality(options.outputFormat, options.outputCompression);
    const src = quality === undefined
      ? canvas.toDataURL(mimeType)
      : canvas.toDataURL(mimeType, quality);

    return {
      ...image,
      source: 'base64',
      src,
      mimeType,
      extension: mimeType.split('/')[1],
      ...requested,
      dimensionStatus: 'resized',
    };
  } catch {
    return image;
  }
}

export async function normalizeBrowserGeneratedImages(
  images: NormalizedImageResult[],
  options: BrowserOutputOptions,
) {
  return Promise.all(images.map((image) => normalizeImage(image, options)));
}
