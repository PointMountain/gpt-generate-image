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

    expect(screen.getByText('1 张输入素材')).toBeInTheDocument();
    expect(screen.getByText('1 张输入素材将随请求发送')).toBeInTheDocument();
    expect(screen.getByText('带素材创作')).toBeInTheDocument();
    expect(screen.getByText('最多 16 张，会随下一次图生图或遮罩编辑发送。')).toBeInTheDocument();
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

    await user.type(screen.getByLabelText('画面描述'), '，电影灯光');
    expect(onChangeForm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '生成图片' }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('updates discrete generation controls through custom dropdowns', async () => {
    const user = userEvent.setup();
    const onChangeForm = vi.fn();

    render(
      <GenerationForm
        form={createDefaultGenerationFormState()}
        selectedModelLabel="gpt-image-1"
        supportsReferenceImages
        canGenerate
        isGenerating={false}
        onChangeForm={onChangeForm}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        onAddReferenceFiles={vi.fn()}
        onRemoveReferenceImage={vi.fn()}
        onSelectMaskFile={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /尺寸/ }));
    await user.click(screen.getByRole('option', { name: /1536 x 1024/ }));

    expect(onChangeForm).toHaveBeenCalledWith(expect.objectContaining({
      size: '1536x1024',
    }));

    await user.click(screen.getByRole('button', { name: /张数/ }));
    await user.click(screen.getByRole('option', { name: '3 张' }));

    expect(onChangeForm).toHaveBeenCalledWith(expect.objectContaining({
      count: 3,
    }));
  });

  it('disables legacy quality while keeping gpt-image-2 transparent output available', async () => {
    const user = userEvent.setup();

    render(
      <GenerationForm
        form={createDefaultGenerationFormState()}
        selectedModelLabel="gpt-image-2"
        supportsReferenceImages
        canGenerate={false}
        isGenerating={false}
        onChangeForm={vi.fn()}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        onAddReferenceFiles={vi.fn()}
        onRemoveReferenceImage={vi.fn()}
        onSelectMaskFile={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /质量/ }));
    expect(screen.getByRole('option', { name: /DALL-E HD/ })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    await user.click(screen.getByText('更多设置', { exact: true }));
    await user.click(screen.getByRole('button', { name: /背景/ }));
    expect(screen.getByRole('option', { name: /^透明/ })).not.toHaveAttribute('aria-disabled');
  });
});
