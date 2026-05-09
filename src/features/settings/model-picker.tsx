import { DropdownField, type DropdownOption } from '../../components/form/dropdown-field';
import type {
  ImageModelCandidate,
  ModelDiscoveryFailure,
} from '../../lib/openai/model-discovery';

export type ModelDiscoveryStatus = 'idle' | 'loading' | 'success' | 'error';

interface ModelPickerProps {
  value: string;
  models: ImageModelCandidate[];
  status: ModelDiscoveryStatus;
  error?: ModelDiscoveryFailure | null;
  fetchedAt?: string;
  canFetchModels: boolean;
  onFetchModels: () => void;
  onChange: (modelId: string) => void;
  validationError?: string;
}

function formatFetchedAt(fetchedAt?: string) {
  if (!fetchedAt) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fetchedAt));
}

function modelToOption(model: ImageModelCandidate): DropdownOption {
  const sourceText = model.source === 'current' ? '当前模型' : model.ownedBy || 'provider';
  const legacyText = model.legacy ? 'Legacy' : '';

  return {
    value: model.id,
    label: model.label,
    description: [model.id, sourceText].filter(Boolean).join(' · '),
    badge: legacyText || (model.source === 'current' ? 'Manual' : undefined),
  };
}

export function ModelPicker({
  value,
  models,
  status,
  error,
  fetchedAt,
  canFetchModels,
  onFetchModels,
  onChange,
  validationError,
}: ModelPickerProps) {
  const options = models.map(modelToOption);
  const hasModels = options.length > 0;
  const isLoading = status === 'loading';
  const fetchedLabel = formatFetchedAt(fetchedAt);

  return (
    <div className="model-picker">
      <div className="model-picker__toolbar">
        <div>
          <p className="section-heading__eyebrow">Model routing</p>
          <h3>图片模型</h3>
          <p>从当前 OpenAI provider 拉取模型列表，只展示图片生成/编辑相关候选。</p>
        </div>
        <button
          className="button button--ghost"
          type="button"
          onClick={onFetchModels}
          disabled={!canFetchModels || isLoading}
        >
          {isLoading ? '拉取中' : canFetchModels ? '拉取模型' : '先填写 API key'}
        </button>
      </div>

      {hasModels ? (
        <DropdownField
          id="openai-model-picker"
          label="图片模型"
          value={value}
          options={options}
          onChange={onChange}
          hint={fetchedLabel ? `上次拉取 ${fetchedLabel}，选择后需保存设置。` : '选择后需保存设置。'}
        />
      ) : (
        <div className="model-picker__empty">
          <strong>{status === 'success' ? '没有发现图片模型' : '还没有拉取模型'}</strong>
          <span>保留手动模型 ID，避免 provider 未返回列表时阻断生成。</span>
        </div>
      )}

      {error ? (
        <div className="inline-alert inline-alert--danger" role="alert">
          <strong>{error.message}</strong>
          {error.recommendation ? <span>{error.recommendation}</span> : null}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="openai-model">手动模型 ID</label>
        <input
          id="openai-model"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="gpt-image-1"
        />
        {validationError ? <span className="field__error">{validationError}</span> : null}
        <span className="field__hint">用于新模型、兼容端点或模型列表不可用时的兜底。</span>
      </div>
    </div>
  );
}
