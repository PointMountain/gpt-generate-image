import type { ResponseMode } from '../../features/providers/provider-types';

export interface NormalizedImageResult {
  id: string;
  source: 'base64' | 'url';
  src: string;
  mimeType?: string;
  fileName?: string;
  extension?: string;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `image-${Math.random().toString(36).slice(2, 10)}`;
}

function toDataUrl(base64: string, mimeType?: string) {
  return `data:${mimeType ?? 'image/png'};base64,${base64}`;
}

function extractImageArray(payload: unknown) {
  if (Array.isArray((payload as { data?: unknown[] })?.data)) {
    return (payload as { data: unknown[] }).data;
  }

  if (Array.isArray((payload as { images?: unknown[] })?.images)) {
    return (payload as { images: unknown[] }).images;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

export function normalizeImageResponse(
  payload: unknown,
  responseMode: ResponseMode,
): NormalizedImageResult[] {
  const items = extractImageArray(payload);

  return items
    .map((item) => {
      if (typeof item === 'string' && /^https?:\/\//.test(item)) {
        return {
          id: createId(),
          source: 'url' as const,
          src: item,
        };
      }

      const record = item as {
        url?: string;
        image_url?: string;
        b64_json?: string;
        base64?: string;
        mime_type?: string;
        mimeType?: string;
        file_name?: string;
        fileName?: string;
      };

      const mimeType = record.mime_type ?? record.mimeType ?? 'image/png';
      const fileName = record.file_name ?? record.fileName;

      if ((responseMode === 'url' || responseMode === 'auto') && (record.url || record.image_url)) {
        return {
          id: createId(),
          source: 'url' as const,
          src: record.url ?? record.image_url ?? '',
          mimeType,
          fileName,
        };
      }

      const base64 = record.b64_json ?? record.base64;
      if (base64) {
        return {
          id: createId(),
          source: 'base64' as const,
          src: toDataUrl(base64, mimeType),
          mimeType,
          fileName,
          extension: mimeType.split('/')[1],
        };
      }

      return null;
    })
    .filter(Boolean) as NormalizedImageResult[];
}
