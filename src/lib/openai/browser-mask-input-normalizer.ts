import type { ImageBinaryInput, ImageReferenceInput } from './image-file-adapter';

interface RequestedCanvas {
  width: number;
  height: number;
}

export interface BrowserMaskInputNormalizationResult {
  referenceImages: ImageReferenceInput[];
  maskFile: ImageBinaryInput | null;
  adapted: boolean;
}

export class BrowserMaskInputNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserMaskInputNormalizationError';
  }
}

function parseRequestedCanvas(size: string): RequestedCanvas | undefined {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return undefined;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

async function toBlob(input: ImageBinaryInput) {
  if (input instanceof Blob) {
    return input;
  }

  return new Blob([await input.arrayBuffer()], { type: input.type });
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new BrowserMaskInputNormalizationError('浏览器无法导出适配后的遮罩画布。'));
      }
    }, 'image/png');
  });
}

async function renderContainedPng(
  bitmap: ImageBitmap,
  requested: RequestedCanvas,
  fileName: string,
  padding: 'transparent' | 'opaque' | 'soft-fill',
) {
  const canvas = document.createElement('canvas');
  canvas.width = requested.width;
  canvas.height = requested.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new BrowserMaskInputNormalizationError('浏览器无法创建遮罩适配画布。');
  }

  const scale = Math.min(requested.width / bitmap.width, requested.height / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const x = Math.round((requested.width - width) / 2);
  const y = Math.round((requested.height - height) / 2);

  if (padding === 'soft-fill') {
    context.fillStyle = '#f3ead8';
    context.fillRect(0, 0, requested.width, requested.height);
    const coverScale = Math.max(requested.width / bitmap.width, requested.height / bitmap.height) * 1.08;
    const coverWidth = Math.round(bitmap.width * coverScale);
    const coverHeight = Math.round(bitmap.height * coverScale);
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
  } else if (padding === 'opaque') {
    context.clearRect(0, 0, requested.width, requested.height);
  } else {
    context.clearRect(0, 0, requested.width, requested.height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, x, y, width, height);
  if (padding === 'opaque') {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, x, requested.height);
    context.fillRect(x + width, 0, requested.width - x - width, requested.height);
    context.fillRect(x, 0, width, y);
    context.fillRect(x, y + height, width, requested.height - y - height);
  }

  const blob = await canvasToPng(canvas);
  const stem = fileName.replace(/\.[^.]+$/, '') || 'mask-input';
  return new File([blob], `${stem}-${requested.width}x${requested.height}.png`, {
    type: 'image/png',
  });
}

export async function normalizeBrowserMaskInputs(
  referenceImages: ImageReferenceInput[],
  maskFile: ImageBinaryInput | null,
  size: string,
  background: string,
): Promise<BrowserMaskInputNormalizationResult> {
  const requested = parseRequestedCanvas(size);
  const source = referenceImages[0];

  if (
    !requested ||
    !source ||
    !maskFile ||
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    return { referenceImages, maskFile, adapted: false };
  }

  const [sourceBitmap, maskBitmap] = await Promise.all([
    createImageBitmap(await toBlob(source.file)),
    createImageBitmap(await toBlob(maskFile)),
  ]);

  try {
    if (sourceBitmap.width !== maskBitmap.width || sourceBitmap.height !== maskBitmap.height) {
      throw new BrowserMaskInputNormalizationError(
        `源图尺寸 ${sourceBitmap.width}×${sourceBitmap.height} 与 mask 尺寸 ${maskBitmap.width}×${maskBitmap.height} 不一致。`,
      );
    }

    if (sourceBitmap.width === requested.width && sourceBitmap.height === requested.height) {
      return { referenceImages, maskFile, adapted: false };
    }

    const [normalizedSource, normalizedMask] = await Promise.all([
      renderContainedPng(
        sourceBitmap,
        requested,
        source.file.name,
        background === 'transparent' ? 'transparent' : 'soft-fill',
      ),
      renderContainedPng(
        maskBitmap,
        requested,
        maskFile.name,
        background === 'transparent' ? 'transparent' : 'opaque',
      ),
    ]);

    return {
      referenceImages: [
        { ...source, file: normalizedSource },
        ...referenceImages.slice(1),
      ],
      maskFile: normalizedMask,
      adapted: true,
    };
  } finally {
    sourceBitmap.close();
    maskBitmap.close();
  }
}
