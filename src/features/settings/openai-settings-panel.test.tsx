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
    expect(screen.getByLabelText('使用本机环境代理')).not.toBeChecked();
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

  it('renders hosted proxy settings without browser API key fields', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <OpenAISettingsPanel
        settings={createDefaultOpenAISettings({ hostedProxy: true })}
        errors={{ proxyAccessToken: '部署访问 token 不能为空。' }}
        onChange={onChange}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Cloudflare Worker 代理')).toBeInTheDocument();
    expect(screen.getByLabelText('部署访问 token')).toBeInTheDocument();
    expect(screen.queryByLabelText('OpenAI API key')).not.toBeInTheDocument();
    expect(screen.queryByText('高级连接设置')).not.toBeInTheDocument();
    expect(screen.getByText('部署访问 token 不能为空。')).toBeInTheDocument();

    await user.type(screen.getByLabelText('部署访问 token'), 'deploy-token');
    expect(onChange).toHaveBeenCalled();
  });
});
