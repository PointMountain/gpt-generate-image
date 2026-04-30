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
    <section>
      <div className="section-heading">
        <div>
          <h3>最近历史</h3>
          <p>保留最近生成记录，方便回填提示词或复用结果图。</p>
        </div>
      </div>

      <div className="stack-list">
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.id} className="stack-card">
              <div className="stack-card__header">
                <strong>{entry.providerLabel}</strong>
                <span>{entry.createdAt.slice(11, 16)}</span>
              </div>
              <p className="stack-card__prompt">{entry.prompt}</p>
              <div className="stack-card__thumb-row">
                {entry.images.slice(0, 2).map((image) => (
                  <button
                    key={image.id}
                    className="stack-card__thumb"
                    type="button"
                    onClick={() => onUseImageAsReference(image)}
                  >
                    <img src={image.src} alt="历史结果缩略图" />
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button className="button button--ghost" type="button" onClick={() => onApply(entry)}>
                  回填到编辑器
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
          <p className="provider-list__empty">暂时还没有历史记录。</p>
        )}
      </div>
    </section>
  );
}
