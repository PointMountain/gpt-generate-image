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
      useProxy: true,
      model: 'gpt-image-2',
      defaultQuality: 'high',
    });

    saveOpenAISettings(settings);

    expect(loadOpenAISettings()).toMatchObject({
      apiKey: 'sk-test',
      baseURL: 'https://example.com/v1',
      useProxy: true,
      model: 'gpt-image-2',
      defaultQuality: 'high',
      needsReconfiguration: false,
    });
  });

  it('ignores legacy provider data and starts from current defaults', () => {
    window.localStorage.setItem('gpt-image-workbench/providers', JSON.stringify({ providers: [] }));

    expect(loadOpenAISettings()).toMatchObject({
      baseURL: 'https://codex.pingchela.xyz/v1',
      model: '',
      timeoutSeconds: 180,
      useProxy: true,
      defaultQuality: 'high',
      needsReconfiguration: false,
    });
  });

  it('keeps static builds in browser API key mode with same-origin proxy enabled', () => {
    expect(createDefaultOpenAISettings()).toMatchObject({
      apiKey: '',
      baseURL: 'https://codex.pingchela.xyz/v1',
      useProxy: true,
      model: '',
      defaultQuality: 'high',
    });
  });

  it('validates the required API key and model fields', () => {
    expect(validateOpenAISettings(createDefaultOpenAISettings())).toEqual({
      apiKey: 'OpenAI API key 不能为空。',
    });

    expect(validateOpenAISettings(createDefaultOpenAISettings({
      apiKey: 'sk-test',
      model: '',
    }))).toMatchObject({
      model: '请选择或填写图片模型。',
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
      baseURL: 'https://codex.pingchela.xyz/v1',
      model: 'gpt-image-2',
      timeoutSeconds: 180,
      useProxy: true,
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

  it('rejects malformed https baseURL values', () => {
    expect(validateOpenAISettings(createDefaultOpenAISettings({
      apiKey: 'sk-test',
      baseURL: 'https://',
    }))).toMatchObject({
      baseURL: 'baseURL 需要填写有效的 https:// 地址。',
    });
  });
});
