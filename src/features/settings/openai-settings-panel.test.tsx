import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultOpenAISettings } from '../../lib/openai/openai-settings-store';
import { OpenAISettingsPanel } from './openai-settings-panel';

describe('openai-settings-panel', () => {
  it('shows the configured default endpoint without implying a model before the API key is set', () => {
    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings()}
        errors={{}}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('baseURL')).toHaveValue('https://codex.pingchela.xyz/v1');
    expect(screen.getByRole('heading', { name: '尚未选择模型' })).toBeInTheDocument();
  });

  it('renders OpenAI-only settings without provider discovery controls', () => {
    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings({ apiKey: 'sk-test' })}
        errors={{}}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '连接图像模型' })).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    expect(screen.getByText('高级连接设置')).toBeInTheDocument();
    expect(screen.getByLabelText('使用同源请求代理')).toBeChecked();
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

  it('lets users reveal and hide the API key without changing it', async () => {
    const user = userEvent.setup();

    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings({ apiKey: 'sk-test' })}
        errors={{}}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const apiKeyInput = screen.getByLabelText('OpenAI API key');
    expect(apiKeyInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: '显示 API key' }));
    expect(apiKeyInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '隐藏 API key' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '隐藏 API key' }));
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });
});
