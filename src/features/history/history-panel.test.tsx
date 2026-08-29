import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPanel } from './history-panel';
import type { HistoryEntry } from './history-types';

const entry: HistoryEntry = {
  id: 'history-1',
  modelId: 'gpt-image-1',
  prompt: '海边温室，电影灯光',
  size: '1024x1024',
  count: 1,
  quality: 'high',
  outputFormat: 'png',
  background: 'auto',
  outputCompression: 0,
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
        onDownload={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('创作档案')).toBeInTheDocument();
    expect(screen.getByText('1 条记录')).toBeInTheDocument();
    expect(screen.getByText('文生图 · 1024x1024')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('keeps prompt reuse, reference reuse, and delete actions available', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onUseImageAsReference = vi.fn();
    const onDownload = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistoryPanel
        entries={[entry]}
        onApply={onApply}
        onUseImageAsReference={onUseImageAsReference}
        onDownload={onDownload}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: '应用创作配方' }));
    await user.click(screen.getByRole('button', { name: '将历史结果 1 加入输入素材' }));
    await user.click(screen.getByRole('button', { name: '下载历史结果 1' }));
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(onApply).toHaveBeenCalledWith(entry);
    expect(onUseImageAsReference).toHaveBeenCalledWith(entry.images[0]);
    expect(onDownload).toHaveBeenCalledWith(entry.images[0], 0);
    expect(screen.getByText('确认删除这次创作？')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDelete).toHaveBeenCalledWith(entry.id);
  });
});
