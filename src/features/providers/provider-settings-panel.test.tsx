import { render, screen } from '@testing-library/react';
import { createEmptyProviderDraft } from './provider-store';
import { ProviderSettingsPanel } from './provider-settings-panel';
import type { DiscoveryState, ProviderConfig } from './provider-types';

const discoveryState: DiscoveryState = {
  status: 'success',
  models: [{ id: 'gpt-image-1', label: 'gpt-image-1' }],
  likelyModelIds: ['gpt-image-1'],
  message: '已发现 1 个模型。',
};

const provider = createEmptyProviderDraft({
  id: 'provider-1',
  name: 'OpenAI Official',
  baseUrl: 'https://api.openai.com/v1',
  preferredModel: 'gpt-image-1',
});

function renderPanel(overrides: Partial<ProviderConfig> = {}) {
  const draft = { ...provider, ...overrides };

  return render(
    <ProviderSettingsPanel
      providers={[provider]}
      activeProviderId={provider.id}
      draft={draft}
      errors={{}}
      discoveryState={discoveryState}
      profile={{
        id: 'default',
        label: 'OpenAI-compatible',
        description: '标准 OpenAI-compatible provider。',
        notes: ['先测试连接。'],
        recommendedModelIds: [],
        recommendedSettings: {
          size: '1024x1024',
          quality: 'high',
          outputFormat: 'png',
          responseMode: 'auto',
        },
      }}
      selectedModelId="gpt-image-1"
      onSelectProvider={vi.fn()}
      onCreateNewProvider={vi.fn()}
      onDuplicateProvider={vi.fn()}
      onDeleteProvider={vi.fn()}
      onDraftChange={vi.fn()}
      onSaveProvider={vi.fn()}
      onDiscoverModels={vi.fn()}
      onSelectModel={vi.fn()}
      onApplyProfileDefaults={vi.fn()}
    />,
  );
}

describe('provider-settings-panel', () => {
  it('keeps provider and model status visible', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'OpenAI Official' })).toBeInTheDocument();
    expect(screen.getAllByText('https://api.openai.com/v1').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('当前模型')).toHaveValue('gpt-image-1');
  });

  it('keeps full provider configuration in a discoverable secondary layer', () => {
    renderPanel();

    expect(screen.getByText('Provider 配置与兼容回退')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Provider 列表' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '编辑 OpenAI Official' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '兼容回退' })).toBeInTheDocument();
  });

  it('surfaces when compatibility fallback is prepared', () => {
    renderPanel({
      fallback: {
        ...provider.fallback,
        enabled: true,
      },
    });

    expect(screen.getByText('兼容回退已准备')).toBeInTheDocument();
  });
});
