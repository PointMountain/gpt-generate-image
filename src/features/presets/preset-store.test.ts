import { beforeEach, describe, expect, it } from 'vitest';
import { createPreset, loadPresets, normalizePresetRecord, removePreset, upsertPreset } from './preset-store';

describe('preset-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds and removes presets', () => {
    const preset = createPreset({
      name: 'Portrait preset',
      prompt: 'portrait lighting',
      size: '1024x1024',
      count: 1,
      quality: 'high',
      outputFormat: 'png',
      background: 'auto',
      outputCompression: 0,
      mode: 'text',
      modelId: 'gpt-image-1',
    });

    const inserted = upsertPreset([], preset);
    expect(inserted).toHaveLength(1);
    expect(removePreset(inserted, preset.id)).toHaveLength(0);
  });

  it('migrates legacy reference mode presets to image mode', () => {
    expect(normalizePresetRecord({
      prompt: 'legacy prompt',
      mode: 'reference' as never,
      count: 9,
      outputCompression: 120,
      outputFormat: 'gif',
    })).toMatchObject({
      prompt: 'legacy prompt',
      mode: 'image',
      count: 4,
      outputCompression: 100,
      outputFormat: 'auto',
    });
  });

  it('normalizes preset records loaded from localStorage', () => {
    window.localStorage.setItem('gpt-image-workbench/presets', JSON.stringify([
      {
        id: 'legacy',
        name: 'Legacy',
        prompt: 'portrait',
        mode: 'reference',
        size: 'bad-size',
        count: '2',
      },
    ]));

    expect(loadPresets()).toEqual([
      expect.objectContaining({
        id: 'legacy',
        mode: 'image',
        size: '1024x1024',
        count: 1,
      }),
    ]);
  });
});
