import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearHistoryEntries,
  listHistoryEntries,
  putHistoryEntry,
} from './indexeddb-history-store';
import type { HistoryEntry } from '../../features/history/history-types';

function createHistoryEntry(): HistoryEntry {
  return {
    id: 'history-1',
    providerId: null,
    providerLabel: 'Provider',
    modelId: 'gpt-image-1',
    prompt: 'cinematic city',
    negativePrompt: '',
    size: '1024x1024',
    count: 1,
    quality: 'high',
    mode: 'text',
    images: [{ id: 'img-1', src: 'data:image/png;base64,abc', source: 'base64' }],
    createdAt: '2026-04-27T12:00:00.000Z',
  };
}

describe('indexeddb-history-store', () => {
  beforeEach(async () => {
    await clearHistoryEntries();
  });

  it('saves and lists history entries', async () => {
    await putHistoryEntry(createHistoryEntry());

    const entries = await listHistoryEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.prompt).toBe('cinematic city');
  });
});
