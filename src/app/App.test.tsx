import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateOpenAIImages } from '../lib/openai/ai-sdk-image-client';
import { fetchOpenAIImageModels } from '../lib/openai/model-discovery';
import { App } from './App';

vi.mock('../lib/openai/ai-sdk-image-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openai/ai-sdk-image-client')>();
  return {
    ...actual,
    generateOpenAIImages: vi.fn(),
  };
});

vi.mock('../lib/openai/model-discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openai/model-discovery')>();
  return {
    ...actual,
    fetchOpenAIImageModels: vi.fn(),
  };
});

describe('App', () => {
  function openSettings() {
    fireEvent.click(screen.getByRole('button', { name: '连接设置' }));
    return screen.getByRole('dialog', { name: '连接图像模型' });
  }

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'scrollTo', {
      value: vi.fn(),
      writable: true,
    });
    Object.defineProperty(window.history, 'scrollRestoration', {
      value: 'auto',
      writable: true,
      configurable: true,
    });
    vi.mocked(generateOpenAIImages).mockReset();
    vi.mocked(fetchOpenAIImageModels).mockReset();
  });

  it('renders the main workbench regions', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '造境' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '把想法压进画布' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '三步开始创作' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '连接图像模型' })).not.toBeInTheDocument();
  });

  it('opens and closes connection settings as a drawer', () => {
    render(<App />);

    const settingsTrigger = screen.getByRole('button', { name: '连接设置' });
    settingsTrigger.focus();
    const dialog = openSettings();
    expect(within(dialog).getByLabelText('OpenAI API key')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭连接设置' }));
    expect(screen.queryByRole('dialog', { name: '连接图像模型' })).not.toBeInTheDocument();
    expect(settingsTrigger).toHaveFocus();
  });

  it('applies saved default parameters to an untouched creation form', () => {
    render(<App />);

    const dialog = openSettings();
    fireEvent.change(within(dialog).getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.change(within(dialog).getByLabelText('手动模型 ID'), {
      target: { value: 'gpt-image-2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /默认质量/ }));
    fireEvent.click(screen.getByRole('option', { name: '高质量' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存 OpenAI 设置' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭连接设置' }));

    expect(screen.getByRole('button', { name: '质量 高质量' })).toBeInTheDocument();
  });

  it('lets the user hide and reopen the first-run guide', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '暂时隐藏引导' }));
    expect(screen.queryByRole('heading', { name: '三步开始创作' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开创作引导' }));
    expect(screen.getByRole('heading', { name: '三步开始创作' })).toBeInTheDocument();
  });

  it('opens the use guide and links to the API key registration page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<App />);

    const guideTrigger = screen.getByRole('button', { name: '观看 1 分 17 秒使用指南' });
    guideTrigger.focus();
    fireEvent.click(guideTrigger);

    const dialog = screen.getByRole('dialog', { name: '使用指南' });
    expect(within(dialog).getByLabelText('中转站与绘图平台使用指南')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '打开链接，获取 API Key' })).toHaveAttribute(
      'href',
      'https://codex.pingchela.xyz/register?aff=4L2D7UE2FAM3',
    );

    const copyButton = within(dialog).getByRole('button', { name: '复制注册链接' });
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'https://codex.pingchela.xyz/register?aff=4L2D7UE2FAM3',
      );
      expect(copyButton).toHaveTextContent('已复制');
    });

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭使用指南' }));
    await waitFor(() => expect(guideTrigger).toHaveFocus());
  });

  it('switches between the creation workbench and the recipe library', () => {
    render(<App />);

    const primaryNavigation = screen.getByRole('navigation', { name: '主导航' });
    fireEvent.click(within(primaryNavigation).getByRole('button', { name: '配方' }));
    expect(screen.getByRole('heading', { name: '创作配方' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '创作历史' })).toBeInTheDocument();

    fireEvent.click(within(primaryNavigation).getByRole('button', { name: '创作' }));
    expect(screen.getByRole('heading', { name: '把想法压进画布' })).toBeInTheDocument();
  });

  it('starts new page loads at the top of the document', () => {
    const previousScrollRestoration = window.history.scrollRestoration;

    const { unmount } = render(<App />);

    expect(window.history.scrollRestoration).toBe('manual');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);

    unmount();
    expect(window.history.scrollRestoration).toBe(previousScrollRestoration);
  });

  it('guards generation against repeated clicks before the first request finishes', async () => {
    vi.mocked(generateOpenAIImages).mockReturnValue(new Promise(() => undefined));
    render(<App />);

    const dialog = openSettings();
    fireEvent.change(within(dialog).getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.change(within(dialog).getByLabelText('手动模型 ID'), {
      target: { value: 'gpt-image-2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭连接设置' }));
    fireEvent.change(screen.getByLabelText('画面描述'), {
      target: { value: 'warm portrait' },
    });

    const generateButton = screen.getByRole('button', { name: '生成图片' });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(generateOpenAIImages).toHaveBeenCalledTimes(1);
    });
  });

  it('fetches image models and selects gpt-image-2 by default', async () => {
    vi.mocked(fetchOpenAIImageModels).mockResolvedValue({
      ok: true,
      fetchedAt: '2026-05-10T01:00:00.000Z',
      models: [
        {
          id: 'gpt-image-1.5',
          label: 'GPT Image 1.5',
          family: 'gpt-image',
          source: 'remote',
          legacy: false,
        },
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          family: 'gpt-image',
          source: 'remote',
          legacy: false,
        },
      ],
    });

    render(<App />);

    const dialog = openSettings();
    fireEvent.change(within(dialog).getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '拉取模型' }));

    await waitFor(() => {
      expect(fetchOpenAIImageModels).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('手动模型 ID')).toHaveValue('gpt-image-2');
    });
  });

  it('clears discovered model candidates when provider settings change', async () => {
    vi.mocked(fetchOpenAIImageModels).mockResolvedValue({
      ok: true,
      fetchedAt: '2026-05-10T01:00:00.000Z',
      models: [
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          family: 'gpt-image',
          source: 'remote',
          legacy: false,
        },
      ],
    });

    render(<App />);

    const dialog = openSettings();
    fireEvent.change(within(dialog).getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '拉取模型' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /图片模型/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('高级连接设置'));
    fireEvent.change(screen.getByLabelText('baseURL'), {
      target: { value: 'https://example.com/v1' },
    });

    expect(screen.queryByRole('button', { name: /图片模型/ })).not.toBeInTheDocument();
    expect(screen.getByText('还没有拉取模型')).toBeInTheDocument();
  });

  it('keeps only the latest model discovery result when requests resolve out of order', async () => {
    let resolveFirst: ((value: Awaited<ReturnType<typeof fetchOpenAIImageModels>>) => void) | undefined;
    let resolveSecond: ((value: Awaited<ReturnType<typeof fetchOpenAIImageModels>>) => void) | undefined;
    vi.mocked(fetchOpenAIImageModels)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecond = resolve;
      }));

    render(<App />);

    const dialog = openSettings();
    fireEvent.change(within(dialog).getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '拉取模型' }));

    fireEvent.click(screen.getByText('高级连接设置'));
    fireEvent.change(screen.getByLabelText('baseURL'), {
      target: { value: 'https://example.com/v1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '拉取模型' }));

    resolveSecond?.({
      ok: true,
      fetchedAt: '2026-05-10T02:00:00.000Z',
      models: [
        {
          id: 'gpt-image-2',
          label: 'GPT Image 2',
          family: 'gpt-image',
          source: 'remote',
          legacy: false,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /图片模型/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /图片模型/ }));
    expect(screen.getByRole('option', { name: /GPT Image 2/ })).toBeInTheDocument();

    resolveFirst?.({
      ok: true,
      fetchedAt: '2026-05-10T01:00:00.000Z',
      models: [
        {
          id: 'dall-e-3',
          label: 'DALL-E-3',
          family: 'dall-e',
          source: 'remote',
          legacy: true,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /DALL-E-3/ })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: /GPT Image 2/ })).toBeInTheDocument();
    });
  });
});
