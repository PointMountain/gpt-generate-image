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
        onAddReferenceFiles={vi.fn()}
        onRemoveReferenceImage={vi.fn()}
        onSelectMaskFile={vi.fn()}
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
          mode: 'image',
          referenceImages: [{
            file: new File(['fake'], 'reference.png', { type: 'image/png' }),
            previewUrl: 'blob:reference-image',
          }],
        })}
        selectedModelLabel="gpt-image-1"
        supportsReferenceImages
        canGenerate
        isGenerating={false}
        onChangeForm={vi.fn()}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        onAddReferenceFiles={vi.fn()}
        onRemoveReferenceImage={vi.fn()}
        onSelectMaskFile={vi.fn()}
      />,
    );

    expect(screen.getAllByText('1 张参考图')).toHaveLength(2);
    expect(screen.getByText('参考图请求')).toBeInTheDocument();
    expect(screen.getByText('最多 16 张，会随下一次图生图或 mask 请求发送。')).toBeInTheDocument();
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
        onAddReferenceFiles={vi.fn()}
        onRemoveReferenceImage={vi.fn()}
        onSelectMaskFile={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('正向提示词'), '，电影灯光');
    expect(onChangeForm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '生成图片' }));
    expect(onGenerate).toHaveBeenCalled();
  });
});
