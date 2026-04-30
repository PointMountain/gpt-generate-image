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
});
