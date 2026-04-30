import { describe, expect, it } from 'vitest';
import { createPreset, removePreset, upsertPreset } from './preset-store';

describe('preset-store', () => {
  it('adds and removes presets', () => {
    const preset = createPreset({
      name: 'Portrait preset',
      prompt: 'portrait lighting',
      negativePrompt: '',
      size: '1024x1024',
      count: 1,
      quality: 'high',
      outputFormat: 'png',
      mode: 'text',
      providerId: null,
      modelId: 'gpt-image-1',
    });

    const inserted = upsertPreset([], preset);
    expect(inserted).toHaveLength(1);
    expect(removePreset(inserted, preset.id)).toHaveLength(0);
  });
});
