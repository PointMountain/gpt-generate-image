import type { ProviderConfig } from './provider-types';

interface ProviderListProps {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  draftProviderId: string;
  onSelect: (providerId: string) => void;
  onCreateNew: () => void;
  onDuplicate: (provider: ProviderConfig) => void;
  onDelete: (providerId: string) => void;
}

export function ProviderList({
  providers,
  activeProviderId,
  draftProviderId,
  onSelect,
  onCreateNew,
  onDuplicate,
  onDelete,
}: ProviderListProps) {
  return (
    <div className="section-card">
      <div className="list-header">
        <div>
          <h3>Provider 列表</h3>
          <p>保存常用 endpoint，切换时不影响当前提示词。</p>
        </div>
        <button className="button button--ghost" type="button" onClick={onCreateNew}>
          新建
        </button>
      </div>

      <div className="provider-list">
        {providers.length ? (
          providers.map((provider) => {
            const isActive = provider.id === activeProviderId;
            const isEditing = provider.id === draftProviderId;

            return (
              <article
                key={provider.id}
                className={`provider-card${isActive ? ' provider-card--active' : ''}`}
              >
                <button
                  className="provider-card__body"
                  type="button"
                  onClick={() => onSelect(provider.id)}
                >
                  <span className="provider-card__title-row">
                    <strong>{provider.name}</strong>
                    {isEditing ? <span className="provider-tag">编辑中</span> : null}
                  </span>
                  <span className="provider-card__meta">{provider.baseUrl || '未配置 baseURL'}</span>
                </button>
                <div className="provider-card__actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => onDuplicate(provider)}
                  >
                    复制
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => onDelete(provider.id)}
                  >
                    删除
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="provider-list__empty">还没有保存 provider，先在下方录入一条。</p>
        )}
      </div>
    </div>
  );
}
