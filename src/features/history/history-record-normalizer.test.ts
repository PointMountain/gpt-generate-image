import { describe, expect, it } from 'vitest';
import { normalizeHistoryEntry } from './history-record-normalizer';

describe('history-record-normalizer', () => {
  it('keeps durable input material and drops malformed records', () => {
    const normalized = normalizeHistoryEntry({
      referenceImages: [
        { dataUrl: 'data:image/png;base64,aA==', fileName: 'source.png', mimeType: 'image/png' },
        { dataUrl: '', fileName: 'broken.png', mimeType: 'image/png' },
      ],
      maskImage: {
        dataUrl: 'data:image/png;base64,bQ==',
        fileName: 'mask.png',
        mimeType: 'image/png',
      },
    });

    expect(normalized.referenceImages).toEqual([
      { dataUrl: 'data:image/png;base64,aA==', fileName: 'source.png', mimeType: 'image/png' },
    ]);
    expect(normalized.maskImage).toEqual({
      dataUrl: 'data:image/png;base64,bQ==',
      fileName: 'mask.png',
      mimeType: 'image/png',
    });
  });
});
