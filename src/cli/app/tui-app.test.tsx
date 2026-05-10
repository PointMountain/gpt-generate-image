import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { TuiApp, createDemoTuiConfig, runTuiGeneration } from './tui-app';

describe('TuiApp', () => {
  it('renders the generation workspace when terminal config is valid', () => {
    const { lastFrame } = render(<TuiApp initialConfig={createDemoTuiConfig()} />);

    expect(lastFrame()).toContain('TokenCanvas CLI');
    expect(lastFrame()).toContain('/help');
    expect(lastFrame()).not.toContain('最近结果');
  });

  it('keeps missing API key inside the slash command workspace', () => {
    const { lastFrame } = render(<TuiApp initialConfig={createDemoTuiConfig({ apiKey: '' })} />);

    expect(lastFrame()).toContain('TokenCanvas CLI');
    expect(lastFrame()).toContain('/config');
  });

  it('uses the current in-memory config for generation instead of reloading stale disk settings', async () => {
    const runGenerateOverride = vi.fn(async (_options, deps) => {
      const loadedConfig = await deps?.loadConfig?.();
      return {
        ok: true as const,
        mode: 'text' as const,
        model: loadedConfig?.model ?? 'unknown',
        outputFiles: [],
      };
    });

    await runTuiGeneration(createDemoTuiConfig({ useProxy: true }), {
      prompt: 'hi',
      mode: 'text',
      reference: [],
    }, runGenerateOverride);

    const deps = runGenerateOverride.mock.calls[0]?.[1];
    const loadedConfig = await deps?.loadConfig?.();

    expect(loadedConfig).toMatchObject({ useProxy: true });
  });
});
