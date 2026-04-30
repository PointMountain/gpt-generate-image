import type { ChangeEvent } from 'react';
import type {
  ProviderConfig,
  ProviderValidationErrors,
} from './provider-types';

interface ProviderFormProps {
  draft: ProviderConfig;
  errors: ProviderValidationErrors;
  onChange: (nextDraft: ProviderConfig) => void;
  onSave: () => void;
  onDiscoverModels: () => void;
}

export function ProviderForm({
  draft,
  errors,
  onChange,
  onSave,
  onDiscoverModels,
}: ProviderFormProps) {
  const updateField =
    (field: keyof ProviderConfig) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...draft,
        [field]: event.target.value,
      });
    };

  return (
    <div className="section-card">
      <div className="list-header">
        <div>
          <h3>{draft.name === '新 provider' ? '新建连接' : `编辑 ${draft.name}`}</h3>
          <p>先填 baseURL 和 key，再拉模型，最后按需要补兼容项。</p>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="provider-name">名称</label>
          <input
            id="provider-name"
            value={draft.name}
            onChange={updateField('name')}
            placeholder="例如：OpenAI Official / My Gateway"
          />
          {errors.name ? <span className="field__error">{errors.name}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="provider-base-url">baseURL</label>
          <input
            id="provider-base-url"
            value={draft.baseUrl}
            onChange={updateField('baseUrl')}
            placeholder="https://api.openai.com 或 https://my-gateway.example.com/v1"
          />
          <span className="field__hint">
            默认会按 OpenAI-compatible 根地址拼接 `/models` 和图片端点。
          </span>
          {errors.baseUrl ? <span className="field__error">{errors.baseUrl}</span> : null}
        </div>

        <div className="field">
          <label htmlFor="provider-api-key">apiKey</label>
          <input
            id="provider-api-key"
            type="password"
            value={draft.apiKey}
            onChange={updateField('apiKey')}
            placeholder="sk-..."
          />
          <span className="field__hint">仅保存在当前浏览器本地，不会上传到服务端。</span>
          {errors.apiKey ? <span className="field__error">{errors.apiKey}</span> : null}
        </div>
      </div>

      <div className="button-row top-gap">
        <button className="button button--primary" type="button" onClick={onSave}>
          保存 provider
        </button>
        <button className="button button--ghost" type="button" onClick={onDiscoverModels}>
          测试并拉模型
        </button>
      </div>
    </div>
  );
}
