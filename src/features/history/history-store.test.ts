import { describe, expect, it } from 'vitest';
import { prependHistoryEntry } from './history-store';
import type { HistoryEntry } from './history-types';

function createEntry(id: string, createdAt: string): HistoryEntry {
  return {
    id,
    modelId: 'gpt-image-1',
    prompt: 'prompt',
    size: '1024x1024',
    count: 1,
    quality: 'high',
    outputFormat: 'png',
    background: 'auto',
    outputCompression: 0,
    mode: 'text',
    images: [],
    createdAt,
  };
}

describe('history-store', () => {
  it('prepends latest item to the front', () => {
    const first = createEntry('1', '2026-04-27T10:00:00.000Z');
    const second = createEntry('2', '2026-04-27T11:00:00.000Z');

    const result = prependHistoryEntry([first], second);

    expect(result[0]?.id).toBe('2');
  });
});
