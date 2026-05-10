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

    expect(screen.getByRole('heading', { name: 'TokenCanvas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '创作下一轮' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OpenAI 设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前结果' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('OpenAI 创作控制条')).getByText('代理')).toBeInTheDocument();
    expect(within(screen.getByLabelText('OpenAI 创作控制条')).getByText('on')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.change(screen.getByLabelText('正向提示词'), {
      target: { value: 'warm portrait' },
    });

    const generateButton = screen.getByRole('button', { name: '生成图片' });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(generateOpenAIImages).toHaveBeenCalledTimes(1);
    });
  });

  it('fetches image models and lets the user select one', async () => {
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

    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(screen.getByLabelText('OpenAI 创作控制条')).getByRole('button', { name: '拉取模型' }));

    await waitFor(() => {
      expect(fetchOpenAIImageModels).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /图片模型/ }));
    fireEvent.click(screen.getByRole('option', { name: /GPT Image 2/ }));

    expect(screen.getByLabelText('手动模型 ID')).toHaveValue('gpt-image-2');
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

    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(screen.getByLabelText('OpenAI 创作控制条')).getByRole('button', { name: '拉取模型' }));

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

    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(within(screen.getByLabelText('OpenAI 创作控制条')).getByRole('button', { name: '拉取模型' }));

    fireEvent.click(screen.getByText('高级连接设置'));
    fireEvent.change(screen.getByLabelText('baseURL'), {
      target: { value: 'https://example.com/v1' },
    });
    fireEvent.click(within(screen.getByLabelText('OpenAI 创作控制条')).getByRole('button', { name: '拉取模型' }));

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
      expect(screen.getByText('1 个候选')).toBeInTheDocument();
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
