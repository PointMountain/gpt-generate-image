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

    await user.click(screen.getByRole('button', { name: '预览' }));
    expect(onPreview).toHaveBeenCalledWith(result);
  });
});
