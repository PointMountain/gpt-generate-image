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
  return (
    <div className="panel-grid panel-grid--compact">
      <div className="surface-header surface-header--tight">
        <div>
          <h2>Provider</h2>
          <p>保存连接、拉取模型，并在必要时打开兼容回退。</p>
        </div>
        <span className="surface-header__badge">Local Only</span>
      </div>

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

      <ModelSelector
        discoveryState={discoveryState}
        selectedModelId={selectedModelId}
        onSelectModel={onSelectModel}
        onRefresh={onDiscoverModels}
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
  );
}
