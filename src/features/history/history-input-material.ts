import type { HistoryInputImage } from './history-types';
import type { ImageBinaryInput } from '../../lib/openai/image-file-adapter';

export async function serializeHistoryInputFile(file: ImageBinaryInput): Promise<HistoryInputImage> {
  const dataUrl = typeof Blob !== 'undefined' && file instanceof Blob
    ? await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('输入素材无法转换为可保存的数据。'));
          return;
        }

        resolve(reader.result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('读取输入素材失败。'));
      reader.readAsDataURL(file);
    })
    : `data:${file.type || 'application/octet-stream'};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;

  return {
    dataUrl,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

export function restoreHistoryInputFile(input: HistoryInputImage): File {
  const separatorIndex = input.dataUrl.indexOf(',');
  if (!input.dataUrl.startsWith('data:') || separatorIndex < 0) {
    throw new Error('历史输入素材格式无效。');
  }

  const metadata = input.dataUrl.slice(5, separatorIndex);
  const encodedData = input.dataUrl.slice(separatorIndex + 1);
  const bytes = metadata.toLowerCase().includes(';base64')
    ? Uint8Array.from(atob(encodedData), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(encodedData));

  return new File([bytes], input.fileName || 'history-input', {
    type: input.mimeType || metadata.split(';')[0] || 'application/octet-stream',
  });
}
