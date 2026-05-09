import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateOpenAIImages } from '../lib/openai/ai-sdk-image-client';
import { App } from './App';

vi.mock('../lib/openai/ai-sdk-image-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openai/ai-sdk-image-client')>();
  return {
    ...actual,
    generateOpenAIImages: vi.fn(),
  };
});

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(generateOpenAIImages).mockReset();
  });

  it('renders the main workbench regions', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TokenCanvas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '创作下一轮' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OpenAI 设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前结果' })).toBeInTheDocument();
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
});
