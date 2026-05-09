import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalConfigStore,
  loadPresetsFromStorage,
  savePresetsToStorage,
} from './local-config-store';

describe('local-config-store', () => {
  beforeEach(() => {
    clearLocalConfigStore();
  });

  it('persists and reloads presets', () => {
    const presets = [{ id: 'preset-1', prompt: 'warm portrait' }];

    savePresetsToStorage(presets);

    expect(loadPresetsFromStorage()).toEqual(presets);
  });

  it('returns an empty list when storage is corrupted', () => {
    window.localStorage.setItem('gpt-image-workbench/presets', '{oops');

    expect(loadPresetsFromStorage()).toEqual([]);
  });
});
