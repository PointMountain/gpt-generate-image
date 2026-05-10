import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { createDemoTuiConfig } from '../tui-app';
import { GenerationScreen } from './generation-screen';

async function waitForInput() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('GenerationScreen', () => {
  it('shows default model and direct generation status', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        historyEntries={[]}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
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
        historyEntries={[]}
        isGenerating={false}
        result={{
          ok: true,
          mode: 'text',
          model: 'gpt-image-1',
          outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
        }}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('/tmp/out.png');
  });

  it('shows a loading state during generation', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        historyEntries={[]}
        isGenerating
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('正在调用 OpenAI 生成图片');
  });

  it('shows config persistence failures in the header', () => {
    const { lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError="配置写入失败：磁盘已满。当前会话使用内存配置。"
        historyEntries={[]}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: false, error: '磁盘已满' })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('配置写入失败：磁盘已满。当前会话使用内存配置。');
  });

  it('opens the /history panel on command and uses Enter to open the selected image', async () => {
    const onOpenHistoryEntry = vi.fn().mockResolvedValue({
      ok: true,
      path: '/tmp/out.png',
      detail: '已打开历史图片：/tmp/out.png',
    });
    const { stdin, lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        historyEntries={[{
          id: 'history-1',
          modelId: 'gpt-image-1',
          prompt: 'warm portrait',
          mode: 'text',
          size: '1024x1024',
          count: 1,
          quality: 'auto',
          outputFormat: 'png',
          background: 'auto',
          outputCompression: 0,
          outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
          createdAt: '2026-05-10T00:00:00.000Z',
        }]}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={onOpenHistoryEntry}
      />,
    );

    await waitForInput();
    stdin.write('/history');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(lastFrame()).toContain('最近结果');

    stdin.write('\r');
    await waitForInput();

    expect(onOpenHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'history-1' }));
  });

  it('shows a fallback message when a history item has no output files', async () => {
    const onOpenHistoryEntry = vi.fn().mockResolvedValue({
      ok: false,
      path: '',
      detail: '历史记录没有可打开的输出文件：stale item',
    });
    const { stdin, lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        historyEntries={[{
          id: 'history-2',
          modelId: 'gpt-image-1',
          prompt: 'stale item',
          mode: 'text',
          size: '1024x1024',
          count: 1,
          quality: 'auto',
          outputFormat: 'png',
          background: 'auto',
          outputCompression: 0,
          outputFiles: [],
          createdAt: '2026-05-10T00:00:00.000Z',
        }]}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={onOpenHistoryEntry}
      />,
    );

    await waitForInput();
    stdin.write('/history');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(lastFrame()).toContain('历史记录没有可打开的输出文件：stale item');
    expect(lastFrame()).not.toContain('↑/↓ 选择，Enter 打开图片');
  });

  it('shows opener failure detail and returns to the console', async () => {
    const onOpenHistoryEntry = vi.fn().mockResolvedValue({
      ok: false,
      path: '/tmp/out.png',
      detail: '自动打开失败：permission denied。请手动打开 /tmp/out.png',
    });
    const { stdin, lastFrame } = render(
      <GenerationScreen
        config={createDemoTuiConfig()}
        configPersistenceError={null}
        historyEntries={[{
          id: 'history-3',
          modelId: 'gpt-image-1',
          prompt: 'failing open',
          mode: 'text',
          size: '1024x1024',
          count: 1,
          quality: 'auto',
          outputFormat: 'png',
          background: 'auto',
          outputCompression: 0,
          outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
          createdAt: '2026-05-10T00:00:00.000Z',
        }]}
        isGenerating={false}
        result={null}
        onSaveConfig={vi.fn().mockResolvedValue({ ok: true })}
        onGenerate={vi.fn()}
        onOpenHistoryEntry={onOpenHistoryEntry}
      />,
    );

    await waitForInput();
    stdin.write('/history');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(lastFrame()).toContain('自动打开失败：permission denied。请手动打开 /tmp/out.png');
    expect(lastFrame()).not.toContain('↑/↓ 选择，Enter 打开图片');
  });
});
