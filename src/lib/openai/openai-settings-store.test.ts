import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultOpenAISettings,
  loadOpenAISettings,
  saveOpenAISettings,
  validateOpenAISettings,
} from './openai-settings-store';

describe('openai-settings-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and reloads OpenAI settings', () => {
    const settings = createDefaultOpenAISettings({
      apiKey: 'sk-test',
      baseURL: 'https://example.com/v1',
      model: 'gpt-image-2',
      defaultQuality: 'high',
    });

    saveOpenAISettings(settings);

    expect(loadOpenAISettings()).toMatchObject({
      apiKey: 'sk-test',
      baseURL: 'https://example.com/v1',
      model: 'gpt-image-2',
      defaultQuality: 'high',
      needsReconfiguration: false,
    });
  });

  it('falls back to defaults and flags legacy provider data', () => {
    window.localStorage.setItem('gpt-image-workbench/providers', JSON.stringify({ providers: [] }));

    expect(loadOpenAISettings()).toMatchObject({
      model: 'gpt-image-1',
      timeoutSeconds: 180,
      needsReconfiguration: true,
    });
  });

  it('validates the required API key and model fields', () => {
    expect(validateOpenAISettings(createDefaultOpenAISettings())).toMatchObject({
      apiKey: 'OpenAI API key 不能为空。',
    });

    expect(validateOpenAISettings(createDefaultOpenAISettings({
      apiKey: 'sk-test',
      model: '',
    }))).toMatchObject({
      model: '模型不能为空，默认可使用 gpt-image-1 或兼容端点支持的 gpt-image-2。',
    });
  });

  it('normalizes polluted stored settings before returning typed state', () => {
    window.localStorage.setItem('gpt-image-workbench/openai-settings', JSON.stringify({
      apiKey: 'sk-test',
      baseURL: 123,
      model: 'gpt-image-2',
      timeoutSeconds: 'slow',
      defaultSize: 'huge',
      defaultOutputCompression: 500,
      defaultOutputFormat: 'gif',
      defaultBackground: 'transparent',
    }));

    expect(loadOpenAISettings()).toMatchObject({
      apiKey: 'sk-test',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-image-2',
      timeoutSeconds: 180,
      defaultSize: '1024x1024',
      defaultOutputFormat: 'auto',
      defaultBackground: 'transparent',
      defaultOutputCompression: 100,
    });
  });

  it('validates baseURL and timeout values', () => {
    expect(validateOpenAISettings(createDefaultOpenAISettings({
      apiKey: 'sk-test',
      baseURL: 'http://example.com/v1',
      timeoutSeconds: 4,
    }))).toMatchObject({
      baseURL: 'baseURL 需要以 https:// 开头。',
      timeoutSeconds: '超时时间至少为 5 秒。',
    });
  });
});
