import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetPanel } from './preset-panel';
import type { PresetRecord } from '../history/history-types';

const preset: PresetRecord = {
  id: 'preset-1',
  name: '低饱和电影感',
  prompt: '海边温室，低饱和胶片感',
  size: '1024x1024',
  count: 1,
  quality: 'high',
  outputFormat: 'png',
  background: 'auto',
  outputCompression: 0,
  mode: 'image',
  modelId: 'gpt-image-1',
  createdAt: '2026-05-01T10:24:00.000Z',
};

describe('preset-panel', () => {
  it('presents presets as prompt assets', () => {
    render(
      <PresetPanel
        presets={[preset]}
        draftName=""
        canSaveCurrent
        onDraftNameChange={vi.fn()}
        onSaveCurrent={vi.fn()}
        onApply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('创作资产')).toBeInTheDocument();
    expect(screen.getByText('1 个配方')).toBeInTheDocument();
    expect(screen.getByText('gpt-image-1 · 1024x1024')).toBeInTheDocument();
    expect(screen.getByText('图生图')).toBeInTheDocument();
  });

  it('keeps save, apply, and delete actions available', async () => {
    const user = userEvent.setup();
    const onDraftNameChange = vi.fn();
    const onSaveCurrent = vi.fn();
    const onApply = vi.fn();
    const onDelete = vi.fn();

    render(
      <PresetPanel
        presets={[preset]}
        draftName="电影感"
        canSaveCurrent
        onDraftNameChange={onDraftNameChange}
        onSaveCurrent={onSaveCurrent}
        onApply={onApply}
        onDelete={onDelete}
      />,
    );

    await user.type(screen.getByLabelText('新配方名称'), '配方');
    await user.click(screen.getByRole('button', { name: '保存当前创作配方' }));
    await user.click(screen.getByRole('button', { name: '应用到创作条' }));
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(onDraftNameChange).toHaveBeenCalled();
    expect(onSaveCurrent).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledWith(preset);
    expect(screen.getByText('确认删除这份配方？')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDelete).toHaveBeenCalledWith(preset.id);
  });
});
