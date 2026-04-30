import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultGallery } from './result-gallery';

const result = {
  id: 'img-1',
  src: 'data:image/png;base64,abc',
  source: 'base64' as const,
};

describe('result-gallery', () => {
  it('renders results and handles preview', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();

    render(
      <ResultGallery
        results={[result]}
        onPreview={onPreview}
        onDownload={vi.fn()}
        onUseAsReference={vi.fn()}
        onReusePrompt={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '当前结果' })).toBeInTheDocument();
    expect(screen.getByText('1 张图片')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '预览' }));
    expect(onPreview).toHaveBeenCalledWith(result);
  });

  it('exposes gallery reuse actions', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onUseAsReference = vi.fn();
    const onReusePrompt = vi.fn();

    render(
      <ResultGallery
        results={[result]}
        onPreview={vi.fn()}
        onDownload={onDownload}
        onUseAsReference={onUseAsReference}
        onReusePrompt={onReusePrompt}
      />,
    );

    await user.click(screen.getByRole('button', { name: '下载' }));
    expect(onDownload).toHaveBeenCalledWith(result, 0);

    await user.click(screen.getByRole('button', { name: '设为参考图' }));
    expect(onUseAsReference).toHaveBeenCalledWith(result);

    await user.click(screen.getByRole('button', { name: '复用提示词' }));
    expect(onReusePrompt).toHaveBeenCalled();
  });

  it('renders an inspiration empty state when there are no results', () => {
    render(
      <ResultGallery
        results={[]}
        onPreview={vi.fn()}
        onDownload={vi.fn()}
        onUseAsReference={vi.fn()}
        onReusePrompt={vi.fn()}
      />,
    );

    expect(screen.getByText('等待第一张作品')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '生成结果会成为你的灵感画廊' })).toBeInTheDocument();
  });
});
