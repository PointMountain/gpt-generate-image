import type {
  OpenAISettingsStoreState,
  OpenAISettingsValidationErrors,
} from '../../lib/openai/openai-settings-store';

interface OpenAISettingsPanelProps {
  settings: OpenAISettingsStoreState;
  errors: OpenAISettingsValidationErrors;
  onChange: (nextSettings: OpenAISettingsStoreState) => void;
  onSave: () => void;
}

const SIZE_OPTIONS = ['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048'];
const QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high', 'standard', 'hd'];
const FORMAT_OPTIONS = ['auto', 'png', 'jpeg', 'webp'];
const BACKGROUND_OPTIONS = ['auto', 'transparent', 'opaque'];

export function OpenAISettingsPanel({
  settings,
  errors,
  onChange,
  onSave,
}: OpenAISettingsPanelProps) {
  function updateField<K extends keyof OpenAISettingsStoreState>(
    field: K,
    value: OpenAISettingsStoreState[K],
  ) {
    onChange({
      ...settings,
      [field]: value,
      needsReconfiguration: false,
    });
  }

  return (
    <div className="panel-grid panel-grid--compact provider-settings-panel">
      <div className="surface-header surface-header--tight">
        <div>
          <h2>OpenAI 设置</h2>
          <p>API key 只保存在当前浏览器，本工作台直接调用 OpenAI 图片模型。</p>
        </div>
        <span className="surface-header__badge">Local Only</span>
      </div>

      {settings.needsReconfiguration ? (
        <div className="section-card section-card--flat">
          <h3>需要重新配置 OpenAI key</h3>
          <p>检测到旧 provider 配置。新版本不再读取 baseURL、模型发现或兼容回退，请保存 OpenAI API key 后继续。</p>
        </div>
      ) : null}

      <div className="provider-status-card">
        <div>
          <p className="section-heading__eyebrow">Connection</p>
          <h3>{settings.model || 'gpt-image-1'}</h3>
          <p>{settings.apiKey ? 'OpenAI key 已填写。' : '填写 OpenAI API key 后即可生成图片。'}</p>
        </div>
        <div className="provider-status-card__badges">
          <span className="provider-tag">OpenAI</span>
          <span className="provider-tag">{settings.timeoutSeconds}s timeout</span>
        </div>
      </div>

      <div className="section-card section-card--flat">
        <div className="field-grid field-grid--two">
          <div className="field">
            <label htmlFor="openai-api-key">OpenAI API key</label>
            <input
              id="openai-api-key"
              type="password"
              value={settings.apiKey}
              onChange={(event) => updateField('apiKey', event.target.value)}
              placeholder="sk-..."
            />
            {errors.apiKey ? <span className="field__error">{errors.apiKey}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="openai-base-url">baseURL</label>
            <input
              id="openai-base-url"
              value={settings.baseURL}
              onChange={(event) => updateField('baseURL', event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            {errors.baseURL ? <span className="field__error">{errors.baseURL}</span> : null}
            <span className="field__hint">默认使用 OpenAI 官方地址；本地测试可填兼容端点。</span>
          </div>

          <div className="field">
            <label htmlFor="openai-model">模型</label>
            <input
              id="openai-model"
              value={settings.model}
              onChange={(event) => updateField('model', event.target.value)}
              placeholder="gpt-image-1"
            />
            {errors.model ? <span className="field__error">{errors.model}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="openai-default-size">默认尺寸</label>
            <select
              id="openai-default-size"
              value={settings.defaultSize}
              onChange={(event) => updateField('defaultSize', event.target.value)}
            >
              {SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="openai-default-quality">默认质量</label>
            <select
              id="openai-default-quality"
              value={settings.defaultQuality}
              onChange={(event) => updateField('defaultQuality', event.target.value)}
            >
              {QUALITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="openai-default-format">默认格式</label>
            <select
              id="openai-default-format"
              value={settings.defaultOutputFormat}
              onChange={(event) => updateField('defaultOutputFormat', event.target.value)}
            >
              {FORMAT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="openai-default-background">默认背景</label>
            <select
              id="openai-default-background"
              value={settings.defaultBackground}
              onChange={(event) => updateField('defaultBackground', event.target.value)}
            >
              {BACKGROUND_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="openai-default-compression">默认压缩</label>
            <input
              id="openai-default-compression"
              type="number"
              min={0}
              max={100}
              value={settings.defaultOutputCompression}
              onChange={(event) => updateField('defaultOutputCompression', Number(event.target.value))}
            />
            <span className="field__hint">0 表示不发送 output_compression。</span>
          </div>

          <div className="field">
            <label htmlFor="openai-timeout">请求超时（秒）</label>
            <input
              id="openai-timeout"
              type="number"
              min={5}
              value={settings.timeoutSeconds}
              onChange={(event) => updateField('timeoutSeconds', Number(event.target.value))}
            />
            {errors.timeoutSeconds ? <span className="field__error">{errors.timeoutSeconds}</span> : null}
          </div>
        </div>

        <div className="button-row top-gap">
          <button className="button button--primary" type="button" onClick={onSave}>
            保存 OpenAI 设置
          </button>
        </div>
      </div>
    </div>
  );
}
