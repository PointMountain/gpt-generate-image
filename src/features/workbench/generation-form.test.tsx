import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultGenerationFormState, GenerationForm } from './generation-form';

describe('generation-form', () => {
  it('disables reference mode when provider capability is off', async () => {
    const user = userEvent.setup();
    const onChangeForm = vi.fn();

    render(
      <GenerationForm
        form={createDefaultGenerationFormState()}
        selectedModelLabel="gpt-image-1"
        supportsReferenceImages={false}
        canGenerate={false}
        isGenerating={false}
        onChangeForm={onChangeForm}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        onSelectReferenceFile={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: '图生图' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onChangeForm).not.toHaveBeenCalled();
  });

  it('shows when a reference image will be sent with the next request', () => {
    render(
      <GenerationForm
        form={createDefaultGenerationFormState({
          mode: 'reference',
          referencePreviewUrl: 'blob:reference-image',
        })}
        selectedModelLabel="gpt-image-1"
        supportsReferenceImages
        canGenerate
        isGenerating={false}
        onChangeForm={vi.fn()}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        onSelectReferenceFile={vi.fn()}
      />,
    );

    expect(screen.getByText('参考图已附加')).toBeInTheDocument();
    expect(screen.getByText('参考图请求')).toBeInTheDocument();
    expect(screen.getByText('这张图片会随下一次图生图请求发送。')).toBeInTheDocument();
  });

  it('keeps prompt editing and generate actions available', async () => {
    const user = userEvent.setup();
    const onChangeForm = vi.fn();
    const onGenerate = vi.fn();

    render(
      <GenerationForm
        form={createDefaultGenerationFormState({ prompt: '海边温室' })}
        selectedModelLabel="gpt-image-1"
        supportsReferenceImages
        canGenerate
        isGenerating={false}
        onChangeForm={onChangeForm}
        onGenerate={onGenerate}
        onClear={vi.fn()}
        onSelectReferenceFile={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('正向提示词'), '，电影灯光');
    expect(onChangeForm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '生成图片' }));
    expect(onGenerate).toHaveBeenCalled();
  });
});
