import type { ResultImage } from '../history/history-types';

function buildResultFileName(image: ResultImage, index: number) {
  return image.fileName || `generated-image-${index + 1}.${image.extension ?? 'png'}`;
}

export async function downloadImage(image: ResultImage, index: number) {
  const link = document.createElement('a');

  if (image.src.startsWith('data:')) {
    link.href = image.src;
    link.download = buildResultFileName(image, index);
    link.click();
    return;
  }

  const response = await fetch(image.src);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = buildResultFileName(image, index);
  link.click();
  URL.revokeObjectURL(objectUrl);
}
