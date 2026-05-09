import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import type { ImageModelCandidate, ModelDiscoveryFailure } from '../../lib/openai/model-discovery';
import { ModelPicker } from './model-picker';

const MODELS: ImageModelCandidate[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    family: 'gpt-image',
    source: 'remote',
    legacy: false,
  },
  {
    id: 'dall-e-3',
    label: 'DALL-E-3',
    family: 'dall-e',
    source: 'remote',
    legacy: true,
  },
];

describe('ModelPicker', () => {
  it('fetches candidates and selects an image model', async () => {
    const user = userEvent.setup();
    const onFetchModels = vi.fn();
    const onChange = vi.fn();

    render(
      <ModelPicker
        value="gpt-image-1"
        models={MODELS}
        status="success"
        canFetchModels
        onFetchModels={onFetchModels}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '拉取模型' }));
    expect(onFetchModels).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /图片模型/ }));
    await user.click(screen.getByRole('option', { name: /GPT Image 2/ }));
    expect(onChange).toHaveBeenCalledWith('gpt-image-2');
  });

  it('keeps manual input available when discovery fails', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const error: ModelDiscoveryFailure = {
      ok: false,
      message: 'OpenAI 模型列表认证失败。',
      recommendation: '检查 OpenAI API key 是否正确、是否仍有效，并重新保存设置。',
    };

    function ControlledPicker() {
      const [value, setValue] = useState('');

      return (
        <ModelPicker
          value={value}
          models={[]}
          status="error"
          error={error}
          canFetchModels
          onFetchModels={vi.fn()}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
      );
    }

    render(<ControlledPicker />);

    expect(screen.getByText('OpenAI 模型列表认证失败。')).toBeInTheDocument();
    await user.type(screen.getByLabelText('手动模型 ID'), 'gpt-image-2');

    expect(onChange).toHaveBeenLastCalledWith('gpt-image-2');
  });

  it('disables fetching until an API key is available', () => {
    render(
      <ModelPicker
        value="gpt-image-1"
        models={[]}
        status="idle"
        canFetchModels={false}
        onFetchModels={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '先填写 API key' })).toBeDisabled();
  });
});
