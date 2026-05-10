import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { createDemoTuiConfig } from '../tui-app';
import { GenerationScreen } from './generation-screen';

describe('GenerationScreen', () => {
  it('shows default model and direct generation status', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('gpt-image-1');
    expect(lastFrame()).toContain('/help 查看指令');
    expect(lastFrame()).toContain('/config');
    expect(lastFrame()).not.toContain('/apikey [value]');
  });

  it('renders successful output paths', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        isGenerating={false}
        result={{
          ok: true,
          mode: 'text',
          model: 'gpt-image-1',
          outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
        }}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('/tmp/out.png');
  });

  it('shows a loading state during generation', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        isGenerating
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('正在调用 OpenAI 生成图片');
  });

  it('shows config persistence failures in the header', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError="配置写入失败：磁盘已满。当前会话使用内存配置。"
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: false, error: '磁盘已满' })}
        onGenerate={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('配置写入失败：磁盘已满。当前会话使用内存配置。');
  });
});
