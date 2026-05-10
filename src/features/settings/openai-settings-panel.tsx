import type {
  OpenAISettingsStoreState,
  OpenAISettingsValidationErrors,
} from '../../lib/openai/openai-settings-store';
import type { ImageModelCandidate, ModelDiscoveryFailure } from '../../lib/openai/model-discovery';
import { DropdownField, type DropdownOption } from '../../components/form/dropdown-field';
import {
  BACKGROUND_OPTIONS as OPENAI_BACKGROUND_OPTIONS,
  FORMAT_OPTIONS as OPENAI_FORMAT_OPTIONS,
  QUALITY_OPTIONS as OPENAI_QUALITY_OPTIONS,
  SIZE_OPTIONS as OPENAI_SIZE_OPTIONS,
} from '../../lib/openai/openai-option-sets';
import { ModelPicker, type ModelDiscoveryStatus } from './model-picker';

interface OpenAISettingsPanelProps {
  settings: OpenAISettingsStoreState;
  errors: OpenAISettingsValidationErrors;
  modelDiscovery?: {
    status: ModelDiscoveryStatus;
    models: ImageModelCandidate[];
    error?: ModelDiscoveryFailure | null;
    fetchedAt?: string;
  };
  onChange: (nextSettings: OpenAISettingsStoreState) => void;
  onSave: () => void;
  onFetchModels?: () => void;
}

const SIZE_OPTIONS: DropdownOption[] = OPENAI_SIZE_OPTIONS;
const QUALITY_OPTIONS: DropdownOption[] = OPENAI_QUALITY_OPTIONS;
const FORMAT_OPTIONS: DropdownOption[] = OPENAI_FORMAT_OPTIONS;
const BACKGROUND_OPTIONS: DropdownOption[] = OPENAI_BACKGROUND_OPTIONS;

export function OpenAISettingsPanel({
  settings,
  errors,
  modelDiscovery = { status: 'idle', models: [] },
  onChange,
  onSave,
  onFetchModels = () => undefined,
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
          <p>{settings.hostedProxy ? '填写部署访问 token 和模型后，就可以通过 Cloudflare Worker 生成图片。' : '保存 API key 和模型后，就可以在创作区直接生成图片。'}</p>
        </div>
        <span className="surface-header__badge">{settings.hostedProxy ? 'Cloudflare Worker 代理' : '本地浏览器保存'}</span>
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
          <p>
            {settings.hostedProxy
              ? settings.proxyAccessToken
                ? '部署访问 token 已填写，可以通过 Worker 生成。'
                : '填写部署访问 token 后即可调用 Worker 代理。'
              : settings.apiKey
                ? 'OpenAI key 已填写，可以生成。'
                : '填写 OpenAI API key 后即可生成图片。'}
          </p>
        </div>
        <div className="provider-status-card__badges">
          <span className="provider-tag">OpenAI</span>
          <span className="provider-tag">{settings.timeoutSeconds}s</span>
          <span className="provider-tag">{settings.hostedProxy ? 'hosted proxy' : `代理 ${settings.useProxy ? 'on' : 'off'}`}</span>
        </div>
      </div>

      <div className="section-card section-card--flat">
        <div className="field-grid">
          {settings.hostedProxy ? (
            <div className="field">
              <label htmlFor="openai-proxy-access-token">部署访问 token</label>
              <input
                id="openai-proxy-access-token"
                type="password"
                value={settings.proxyAccessToken}
                onChange={(event) => updateField('proxyAccessToken', event.target.value)}
                placeholder="token..."
              />
              {errors.proxyAccessToken ? <span className="field__error">{errors.proxyAccessToken}</span> : null}
              <span className="field__hint">此 token 只用于访问你的 Cloudflare Worker 代理，不是 OpenAI API key。</span>
            </div>
          ) : (
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
          )}
        </div>

        <ModelPicker
          value={settings.model}
          models={modelDiscovery.models}
          status={modelDiscovery.status}
          error={modelDiscovery.error}
          fetchedAt={modelDiscovery.fetchedAt}
          canFetchModels={settings.hostedProxy ? Boolean(settings.proxyAccessToken.trim()) : Boolean(settings.apiKey.trim())}
          onFetchModels={onFetchModels}
          onChange={(modelId) => updateField('model', modelId)}
          validationError={errors.model}
        />

        <div className="button-row top-gap">
          <button className="button button--primary" type="button" onClick={onSave}>
            {settings.hostedProxy ? '保存部署设置' : '保存 OpenAI 设置'}
          </button>
        </div>
      </div>

      <div className="section-card section-card--flat">
        <div className="list-header list-header--compact">
          <div>
            <h3>默认生成参数</h3>
            <p>新建创作会从这些默认值开始，单次生成仍可在创作区调整。</p>
          </div>
        </div>

        <div className="field-grid field-grid--two">
          <DropdownField
            id="openai-default-size"
            label="默认尺寸"
            value={settings.defaultSize}
            options={SIZE_OPTIONS}
            onChange={(value) => updateField('defaultSize', value)}
          />

          <DropdownField
            id="openai-default-quality"
            label="默认质量"
            value={settings.defaultQuality}
            options={QUALITY_OPTIONS}
            onChange={(value) => updateField('defaultQuality', value)}
          />

          <DropdownField
            id="openai-default-format"
            label="默认格式"
            value={settings.defaultOutputFormat}
            options={FORMAT_OPTIONS}
            onChange={(value) => updateField('defaultOutputFormat', value)}
          />

          <DropdownField
            id="openai-default-background"
            label="默认背景"
            value={settings.defaultBackground}
            options={BACKGROUND_OPTIONS}
            onChange={(value) => updateField('defaultBackground', value)}
          />

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

        </div>
      </div>

      {!settings.hostedProxy ? (
        <details className="settings-disclosure">
        <summary>
          <span>
            高级连接设置
            <small>保留给本地调试。正常使用 OpenAI 官方接口时无需修改。</small>
          </span>
        </summary>

        <div className="settings-disclosure__content">
          <div className="field">
            <label htmlFor="openai-base-url">baseURL</label>
            <input
              id="openai-base-url"
              value={settings.baseURL}
              onChange={(event) => updateField('baseURL', event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            {errors.baseURL ? <span className="field__error">{errors.baseURL}</span> : null}
            <span className="field__hint">默认使用 OpenAI 官方地址；本地测试可填受信任端点。</span>
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

          <label className="toggle-row" htmlFor="openai-use-proxy">
            <input
              id="openai-use-proxy"
              type="checkbox"
              checked={settings.useProxy}
              onChange={(event) => updateField('useProxy', event.target.checked)}
            />
            <span>使用本机环境代理</span>
          </label>
          <span className="field__hint">默认关闭。开启后本地 dev proxy 会继承 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY。</span>
        </div>
      </details>
      ) : null}
    </div>
  );
}
