import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it('falls back to defaults and flags legacy provider data', () => {
    window.localStorage.setItem('gpt-image-workbench/providers', JSON.stringify({ providers: [] }));

    expect(loadOpenAISettings()).toMatchObject({
      model: 'gpt-image-1',
      timeoutSeconds: 180,
      useProxy: false,
      needsReconfiguration: true,
    });
  });

  it('defaults to hosted proxy when the Cloudflare build env is enabled', () => {
    vi.stubEnv('VITE_TOKENCANVAS_HOSTED_PROXY', 'true');

    expect(createDefaultOpenAISettings()).toMatchObject({
      hostedProxy: true,
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

  it('validates hosted proxy token instead of browser OpenAI key in hosted mode', () => {
    expect(validateOpenAISettings(createDefaultOpenAISettings({
      hostedProxy: true,
      apiKey: '',
      proxyAccessToken: '',
      baseURL: 'http://invalid.local/v1',
    }))).toMatchObject({
      proxyAccessToken: '部署访问 token 不能为空。',
    });

    expect(validateOpenAISettings(createDefaultOpenAISettings({
      hostedProxy: true,
      apiKey: '',
      proxyAccessToken: 'deploy-token',
      baseURL: 'http://invalid.local/v1',
    }))).toEqual({});
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
      useProxy: false,
      hostedProxy: false,
      proxyAccessToken: '',
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
