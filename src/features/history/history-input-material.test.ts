import { describe, expect, it } from 'vitest';
import {
  restoreHistoryInputFile,
  serializeHistoryInputFile,
} from './history-input-material';

describe('history-input-material', () => {
  it('round-trips an input image through a durable data URL', async () => {
    const original = new File([new Uint8Array([137, 80, 78, 71])], 'source.png', {
      type: 'image/png',
    });

    const stored = await serializeHistoryInputFile(original);
    const restored = restoreHistoryInputFile(stored);

    expect(stored).toMatchObject({
      fileName: 'source.png',
      mimeType: 'image/png',
    });
    expect(stored.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(restored.name).toBe(original.name);
    expect(restored.type).toBe(original.type);
    expect(restored.size).toBe(original.size);
  });
});
