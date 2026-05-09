import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultOpenAISettings } from '../../lib/openai/openai-settings-store';
import { OpenAISettingsPanel } from './openai-settings-panel';

describe('openai-settings-panel', () => {
  it('renders OpenAI-only settings without provider discovery controls', () => {
    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings({ apiKey: 'sk-test' })}
        errors={{}}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'OpenAI 设置' })).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    expect(screen.getByText('高级连接设置')).toBeInTheDocument();
    expect(screen.queryByText('Provider 配置与兼容回退')).not.toBeInTheDocument();
  });

  it('updates API key and saves settings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings()}
        errors={{}}
        onChange={onChange}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText('OpenAI API key'), 'sk-test');
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '保存 OpenAI 设置' }));
    expect(onSave).toHaveBeenCalled();
  });
});
