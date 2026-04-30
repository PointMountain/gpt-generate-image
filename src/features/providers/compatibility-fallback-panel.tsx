import type { ChangeEvent } from 'react';
import type { ProviderFallbackConfig } from './provider-types';

interface CompatibilityFallbackPanelProps {
  fallback: ProviderFallbackConfig;
  onChange: (nextFallback: ProviderFallbackConfig) => void;
}

export function CompatibilityFallbackPanel({
  fallback,
  onChange,
}: CompatibilityFallbackPanelProps) {
  const updateField =
    (field: keyof ProviderFallbackConfig) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      const target = event.target;
      const nextValue =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target.value;

      onChange({
        ...fallback,
        [field]: nextValue,
      });
    };

  return (
    <div className="section-card">
      <div className="list-header">
        <div>
          <h3>兼容回退</h3>
          <p>只保留必要字段，用来修正不完整兼容的 provider。</p>
        </div>
      </div>

      <div className="field-grid">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(fallback.useLocalProxy)}
            onChange={updateField('useLocalProxy')}
          />
          通过本地代理转发请求
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(fallback.enabled)}
            onChange={updateField('enabled')}
          />
          启用兼容回退
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(fallback.skipDiscovery)}
            onChange={updateField('skipDiscovery')}
          />
          跳过模型发现，直接手填模型
        </label>

        <div className="field">
          <label htmlFor="fallback-model">手动模型名</label>
          <input
            id="fallback-model"
            value={fallback.manualModelId}
            onChange={updateField('manualModelId')}
            placeholder="gpt-image-1 / flux-dev / 自定义模型"
          />
        </div>

        <div className="field">
          <label htmlFor="fallback-endpoint">图片端点覆盖</label>
          <input
            id="fallback-endpoint"
            value={fallback.imageEndpointOverride}
            onChange={updateField('imageEndpointOverride')}
            placeholder="images/generations 或完整 URL"
          />
        </div>

        <div className="field">
          <label htmlFor="fallback-headers">额外 Headers</label>
          <textarea
            id="fallback-headers"
            value={fallback.extraHeadersText}
            onChange={updateField('extraHeadersText')}
            placeholder={'api-version: 2024-08-01-preview\nx-provider: gateway'}
          />
        </div>

        <div className="field">
          <label htmlFor="fallback-query">额外 Query</label>
          <textarea
            id="fallback-query"
            value={fallback.extraQueryText}
            onChange={updateField('extraQueryText')}
            placeholder={'api-version=2024-08-01-preview\nproject=demo'}
          />
        </div>

        <div className="field-grid field-grid--two">
          <label className="toggle-row">
              <input
                type="checkbox"
                checked={Boolean(fallback.supportsReferenceImages)}
                onChange={updateField('supportsReferenceImages')}
              />
              支持参考图
          </label>

          <div className="field">
            <label htmlFor="fallback-response-mode">返回模式</label>
            <select
              id="fallback-response-mode"
              value={fallback.responseMode}
              onChange={updateField('responseMode')}
            >
              <option value="auto">自动探测</option>
              <option value="base64">强制 base64</option>
              <option value="url">强制 URL</option>
            </select>
          </div>
        </div>

        <p className="field__hint">
          本地开发环境建议开启本地代理，可绕过浏览器对第三方 provider 的 CORS 限制。
        </p>
      </div>
    </div>
  );
}
