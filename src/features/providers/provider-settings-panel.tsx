import { CompatibilityHelp } from '../onboarding/compatibility-help';
import type { ProviderProfile } from '../../lib/openai/provider-profile';
import { CompatibilityFallbackPanel } from './compatibility-fallback-panel';
import { ModelSelector } from './model-selector';
import { ProviderForm } from './provider-form';
import { ProviderList } from './provider-list';
import type {
  DiscoveryState,
  ProviderConfig,
  ProviderValidationErrors,
} from './provider-types';

interface ProviderSettingsPanelProps {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  draft: ProviderConfig;
  errors: ProviderValidationErrors;
  discoveryState: DiscoveryState;
  profile: ProviderProfile;
  selectedModelId: string;
  onSelectProvider: (providerId: string) => void;
  onCreateNewProvider: () => void;
  onDuplicateProvider: (provider: ProviderConfig) => void;
  onDeleteProvider: (providerId: string) => void;
  onDraftChange: (nextDraft: ProviderConfig) => void;
  onSaveProvider: () => void;
  onDiscoverModels: () => void;
  onSelectModel: (modelId: string) => void;
  onApplyProfileDefaults: () => void;
}

export function ProviderSettingsPanel({
  providers,
  activeProviderId,
  draft,
  errors,
  discoveryState,
  profile,
  selectedModelId,
  onSelectProvider,
  onCreateNewProvider,
  onDuplicateProvider,
  onDeleteProvider,
  onDraftChange,
  onSaveProvider,
  onDiscoverModels,
  onSelectModel,
  onApplyProfileDefaults,
}: ProviderSettingsPanelProps) {
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const providerLabel = activeProvider?.name ?? draft.name;
  const configuredProviderCount = providers.length;
  const fallbackEnabled = draft.fallback.enabled || draft.fallback.skipDiscovery;

  return (
    <div className="panel-grid panel-grid--compact provider-settings-panel">
      <div className="surface-header surface-header--tight">
        <div>
          <h2>Provider</h2>
          <p>保持当前连接和模型可见，详细配置需要时再展开。</p>
        </div>
        <span className="surface-header__badge">Local Only</span>
      </div>

      <div className="provider-status-card">
        <div>
          <p className="section-heading__eyebrow">Connection</p>
          <h3>{providerLabel || '未配置 provider'}</h3>
          <p>{activeProvider?.baseUrl || draft.baseUrl || '添加 baseURL 和 key 后即可测试连接。'}</p>
        </div>
        <div className="provider-status-card__badges">
          <span className="provider-tag">{configuredProviderCount} 个 provider</span>
          {fallbackEnabled ? <span className="provider-tag">兼容回退已准备</span> : null}
        </div>
      </div>

      <ModelSelector
        discoveryState={discoveryState}
        selectedModelId={selectedModelId}
        onSelectModel={onSelectModel}
        onRefresh={onDiscoverModels}
      />

      <details className="settings-disclosure">
        <summary>
          <span>
            <strong>Provider 配置与兼容回退</strong>
            <small>管理连接、发现模型，并在非标准 provider 上手动补齐参数。</small>
          </span>
        </summary>

        <div className="settings-disclosure__content">
          <CompatibilityHelp profile={profile} onApplyProfileDefaults={onApplyProfileDefaults} />

          <ProviderList
            providers={providers}
            activeProviderId={activeProviderId}
            draftProviderId={draft.id}
            onSelect={onSelectProvider}
            onCreateNew={onCreateNewProvider}
            onDuplicate={onDuplicateProvider}
            onDelete={onDeleteProvider}
          />

          <ProviderForm
            draft={draft}
            errors={errors}
            onChange={onDraftChange}
            onSave={onSaveProvider}
            onDiscoverModels={onDiscoverModels}
          />

          <CompatibilityFallbackPanel
            fallback={draft.fallback}
            onChange={(nextFallback) =>
              onDraftChange({
                ...draft,
                fallback: nextFallback,
              })
            }
          />
        </div>
      </details>
    </div>
  );
}
