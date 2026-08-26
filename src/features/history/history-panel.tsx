import { useState } from 'react';
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <section className="inspiration-surface">
      <div className="section-heading inspiration-surface__header">
        <div>
          <p className="section-heading__eyebrow">创作档案</p>
          <h3>创作历史</h3>
          <p>回看每次创作轮次，复用创作配方，或把结果加入下一轮输入素材。</p>
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
                      aria-label={`将历史结果 ${index + 1} 加入输入素材`}
                    >
                      <img src={image.src} alt="历史结果缩略图" />
                    </button>
                  ))}
                  {entry.images.length > 2 ? <span className="stack-card__count">+{entry.images.length - 2}</span> : null}
                </div>
              ) : null}
              {pendingDeleteId === entry.id ? (
                <div className="inline-delete-confirmation" role="group" aria-label="删除创作确认">
                  <p>确认删除这次创作？</p>
                  <div className="button-row">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      取消删除
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => {
                        onDelete(entry.id);
                        setPendingDeleteId(null);
                      }}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              ) : (
                <div className="button-row">
                  <button className="button button--ghost" type="button" onClick={() => onApply(entry)}>
                    应用创作配方
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => setPendingDeleteId(entry.id)}
                  >
                    删除
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="provider-list__empty">暂时还没有创作历史，生成后的作品会出现在这里。</p>
        )}
      </div>
    </section>
  );
}
