import { useEffect, useState } from 'react';
import { DEFAULT_BROWSER_OPENAI_BASE_URL } from '../../lib/openai/openai-settings-store';
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
import {
  supportsLegacyImageQuality,
  supportsTransparentBackground,
} from '../../lib/openai/ai-sdk-image-client';

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
  showHeading?: boolean;
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
  showHeading = true,
}: OpenAISettingsPanelProps) {
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const supportsDefaultCompression = settings.defaultOutputFormat === 'jpeg' || settings.defaultOutputFormat === 'webp';
  useEffect(() => {
    const firstInvalidFieldId = (
      errors.apiKey ? 'openai-api-key'
        : errors.model ? 'openai-model'
          : errors.baseURL ? 'openai-base-url'
            : errors.timeoutSeconds ? 'openai-timeout'
              : ''
    );

    if (firstInvalidFieldId) {
      document.getElementById(firstInvalidFieldId)?.focus();
    }
  }, [errors]);

  const qualityOptions = QUALITY_OPTIONS.map((option) => (
    ['standard', 'hd'].includes(option.value) && !supportsLegacyImageQuality(settings.model)
      ? { ...option, disabled: true, description: '仅 DALL-E 模型支持' }
      : option
  ));
  const backgroundOptions = BACKGROUND_OPTIONS.map((option) => (
    option.value === 'transparent' && (
      !supportsTransparentBackground(settings.model) || settings.defaultOutputFormat === 'jpeg'
    )
      ? {
          ...option,
          disabled: true,
          description: settings.defaultOutputFormat === 'jpeg'
            ? 'JPEG 不支持透明背景'
            : `${settings.model || '当前模型'} 暂不支持`,
        }
      : option
  ));

  function updateField<K extends keyof OpenAISettingsStoreState>(
    field: K,
    value: OpenAISettingsStoreState[K],
  ) {
    const nextSettings: OpenAISettingsStoreState = {
      ...settings,
      [field]: value,
      needsReconfiguration: false,
    };

    if (
      field === 'defaultOutputFormat' &&
      value === 'jpeg' &&
      nextSettings.defaultBackground === 'transparent'
    ) {
      nextSettings.defaultBackground = 'auto';
    }
    if (field === 'defaultOutputFormat' && typeof value === 'string' && !['jpeg', 'webp'].includes(value)) {
      nextSettings.defaultOutputCompression = 0;
    }

    onChange(nextSettings);
  }

  return (
    <div className="panel-grid panel-grid--compact provider-settings-panel">
      {showHeading ? (
        <div className="surface-header surface-header--tight">
          <div>
            <h2>连接图像模型</h2>
            <p>保存 API key、baseURL 和模型后，就可以开始创作。</p>
          </div>
          <span className="surface-header__badge">仅保存在本机</span>
        </div>
      ) : null}

      <div className="provider-status-card">
        <div>
          <p className="section-heading__eyebrow">Connection</p>
          <h3>{settings.model || '尚未选择模型'}</h3>
          <p>
            {settings.apiKey
              ? settings.model
                ? 'OpenAI key 已填写；可用性会在首次生成时确认。'
                : 'API key 已填写；拉取模型后会优先选择 gpt-image-2。'
              : '填写 OpenAI API key 后即可生成图片。'}
          </p>
        </div>
        <div className="provider-status-card__badges">
          <span className="provider-tag">OpenAI</span>
          <span className="provider-tag">{settings.timeoutSeconds}s</span>
          <span className="provider-tag">{`代理 ${settings.useProxy ? 'on' : 'off'}`}</span>
        </div>
      </div>

      <div className="section-card section-card--flat">
        <div className="field-grid">
          <div className="field">
            <label htmlFor="openai-api-key">OpenAI API key</label>
            <div className="secret-input">
              <input
                id="openai-api-key"
                type={isApiKeyVisible ? 'text' : 'password'}
                autoComplete="off"
                value={settings.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                placeholder="sk-..."
              />
              <button
                className="secret-input__toggle"
                type="button"
                aria-label={`${isApiKeyVisible ? '隐藏' : '显示'} API key`}
                aria-pressed={isApiKeyVisible}
                onClick={() => setIsApiKeyVisible((isVisible) => !isVisible)}
              >
                {isApiKeyVisible ? '隐藏' : '显示'}
              </button>
            </div>
            {errors.apiKey ? <span className="field__error">{errors.apiKey}</span> : null}
          </div>
        </div>

        <ModelPicker
          value={settings.model}
          models={modelDiscovery.models}
          status={modelDiscovery.status}
          error={modelDiscovery.error}
          fetchedAt={modelDiscovery.fetchedAt}
          canFetchModels={Boolean(settings.apiKey.trim())}
          onFetchModels={onFetchModels}
          onChange={(modelId) => updateField('model', modelId)}
          validationError={errors.model}
        />

        <div className="button-row top-gap">
          <button className="button button--primary" type="button" onClick={onSave}>
            保存 OpenAI 设置
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
            options={qualityOptions}
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
            options={backgroundOptions}
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
              disabled={!supportsDefaultCompression}
              onChange={(event) => updateField('defaultOutputCompression', Number(event.target.value))}
            />
            <span className="field__hint">
              {supportsDefaultCompression ? '0 表示不发送 output_compression。' : '仅 JPEG 与 WEBP 支持压缩。'}
            </span>
          </div>

        </div>
      </div>

      <details className="settings-disclosure">
        <summary>
          <span>
            高级连接设置
            <small>默认使用同源代理，避免浏览器跨域限制。</small>
          </span>
        </summary>

        <div className="settings-disclosure__content">
          <div className="field">
            <label htmlFor="openai-base-url">baseURL</label>
            <input
              id="openai-base-url"
              autoComplete="url"
              value={settings.baseURL}
              onChange={(event) => updateField('baseURL', event.target.value)}
              placeholder={DEFAULT_BROWSER_OPENAI_BASE_URL}
            />
            {errors.baseURL ? <span className="field__error">{errors.baseURL}</span> : null}
            <span className="field__hint">
              默认请求 codex.pingchela.xyz；API key 会随请求发送到该端点，也可以改成其他 OpenAI 图片兼容地址。
            </span>
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
            <span>使用同源请求代理</span>
          </label>
          <span className="field__hint">默认开启。Cloudflare 会转发你在页面填写的 key 和 baseURL，不保存服务端密钥；本地 dev proxy 会继承 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY。</span>
        </div>
      </details>
    </div>
  );
}
