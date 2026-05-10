import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  createDefaultTerminalConfig,
  loadTerminalConfig,
  normalizeTerminalConfig,
  resolveTerminalConfigDir,
  saveTerminalConfig,
  validateTerminalConfig,
} from './terminal-config-store';

async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'tokencanvas-config-test-'));
}

describe('terminal-config-store', () => {
  it('returns defaults without reading browser storage', async () => {
    window.localStorage.setItem('gpt-image-workbench/openai-settings', JSON.stringify({ apiKey: 'browser-key' }));

    const config = await loadTerminalConfig(await createTempDir());

    expect(config.apiKey).toBe('');
    expect(config.model).toBe('gpt-image-1');
  });

  it('saves and reloads terminal config from an isolated directory', async () => {
    const configDir = await createTempDir();
    const config = createDefaultTerminalConfig({
      apiKey: 'sk-test',
      model: 'gpt-image-2',
      useProxy: true,
      outputDir: 'out',
    });

    await saveTerminalConfig(config, configDir);

    await expect(loadTerminalConfig(configDir)).resolves.toEqual(config);
  });

  it('surfaces malformed config files instead of silently falling back', async () => {
    const configDir = await createTempDir();
    await writeFile(join(configDir, 'config.json'), '{bad json');

    await expect(loadTerminalConfig(configDir)).rejects.toThrow(/不是有效 JSON/);
  });

  it('normalizes polluted config values', () => {
    expect(normalizeTerminalConfig({
      defaultSize: 'wrong',
      useProxy: 'yes' as never,
      defaultOutputCompression: 200,
      historyLimit: -1,
    })).toMatchObject({
      defaultSize: '1024x1024',
      useProxy: false,
      defaultOutputCompression: 100,
      historyLimit: 1,
    });
  });

  it('validates required terminal settings', () => {
    expect(validateTerminalConfig(createDefaultTerminalConfig())).toMatchObject({
      apiKey: 'OpenAI API key 不能为空。',
    });
  });

  it('prefers TOKENCANVAS_CONFIG_DIR over XDG defaults', () => {
    expect(resolveTerminalConfigDir({
      TOKENCANVAS_CONFIG_DIR: '/tmp/token-config',
      XDG_CONFIG_HOME: '/tmp/xdg',
    }, '/home/test')).toBe('/tmp/token-config');
  });
});
