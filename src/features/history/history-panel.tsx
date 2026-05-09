import type { HistoryEntry, ResultImage } from './history-types';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  onApply: (entry: HistoryEntry) => void;
  onUseImageAsReference: (image: ResultImage) => void;
  onDelete: (entryId: string) => void;
}

export function HistoryPanel({
  entries,
  onApply,
  onUseImageAsReference,
  onDelete,
}: HistoryPanelProps) {
  return (
    <section className="inspiration-surface">
      <div className="section-heading inspiration-surface__header">
        <div>
          <p className="section-heading__eyebrow">Recent Inspiration</p>
          <h3>最近历史</h3>
          <p>把生成记录作为灵感资产复用，快速回填提示词或继续图生图迭代。</p>
        </div>
        {entries.length ? <span className="surface-header__badge">{entries.length} 条记录</span> : null}
      </div>

      <div className="stack-list">
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="stack-card stack-card--asset">
              <div className="stack-card__header">
                <div>
                  <strong>{entry.modelId || '未指定模型'}</strong>
                  <p className="stack-card__meta">
                    {entry.mode === 'mask' ? '遮罩编辑' : entry.mode === 'image' ? '图生图' : '文生图'} · {entry.size}
                  </p>
                </div>
                <span>{entry.createdAt.slice(11, 16)}</span>
              </div>
              <p className="stack-card__prompt">{entry.prompt}</p>
              {entry.images.length ? (
                <div className="stack-card__thumb-row">
                  {entry.images.slice(0, 2).map((image, index) => (
                    <button
                      key={image.id}
                      className="stack-card__thumb"
                      type="button"
                      onClick={() => onUseImageAsReference(image)}
                      aria-label={`将历史结果 ${index + 1} 设为参考图`}
                    >
                      <img src={image.src} alt="历史结果缩略图" />
                    </button>
                  ))}
                  {entry.images.length > 2 ? <span className="stack-card__count">+{entry.images.length - 2}</span> : null}
                </div>
              ) : null}
              <div className="button-row">
                <button className="button button--ghost" type="button" onClick={() => onApply(entry)}>
                  复用提示词
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => onDelete(entry.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="provider-list__empty">暂时还没有历史记录，生成后的作品会沉淀在这里。</p>
        )}
      </div>
    </section>
  );
}
