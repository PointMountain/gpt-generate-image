import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPanel } from './history-panel';
import type { HistoryEntry } from './history-types';

const entry: HistoryEntry = {
  id: 'history-1',
  providerId: 'provider-1',
  providerLabel: 'OpenAI Official',
  modelId: 'gpt-image-1',
  prompt: '海边温室，电影灯光',
  negativePrompt: '',
  size: '1024x1024',
  count: 1,
  quality: 'high',
  mode: 'text',
  images: [
    { id: 'image-1', src: 'data:image/png;base64,a', source: 'base64' },
    { id: 'image-2', src: 'data:image/png;base64,b', source: 'base64' },
    { id: 'image-3', src: 'data:image/png;base64,c', source: 'base64' },
  ],
  createdAt: '2026-05-01T10:24:00.000Z',
};

describe('history-panel', () => {
  it('presents history as reusable inspiration assets', () => {
    render(
      <HistoryPanel
        entries={[entry]}
        onApply={vi.fn()}
        onUseImageAsReference={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Recent Inspiration')).toBeInTheDocument();
    expect(screen.getByText('1 条记录')).toBeInTheDocument();
    expect(screen.getByText('gpt-image-1 · 1024x1024')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('keeps prompt reuse, reference reuse, and delete actions available', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onUseImageAsReference = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistoryPanel
        entries={[entry]}
        onApply={onApply}
        onUseImageAsReference={onUseImageAsReference}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: '复用提示词' }));
    await user.click(screen.getByRole('button', { name: '将历史结果 1 设为参考图' }));
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(onApply).toHaveBeenCalledWith(entry);
    expect(onUseImageAsReference).toHaveBeenCalledWith(entry.images[0]);
    expect(onDelete).toHaveBeenCalledWith(entry.id);
  });
});
