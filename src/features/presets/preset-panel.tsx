import { useState } from 'react';
import type { PresetRecord } from '../history/history-types';

interface PresetPanelProps {
  presets: PresetRecord[];
  draftName: string;
  canSaveCurrent: boolean;
  onDraftNameChange: (value: string) => void;
  onSaveCurrent: () => void;
  onApply: (preset: PresetRecord) => void;
  onDelete: (presetId: string) => void;
}

export function PresetPanel({
  presets,
  draftName,
  canSaveCurrent,
  onDraftNameChange,
  onSaveCurrent,
  onApply,
  onDelete,
}: PresetPanelProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <section className="inspiration-surface">
      <div className="section-heading inspiration-surface__header">
        <div>
          <p className="section-heading__eyebrow">创作资产</p>
          <h3>创作配方</h3>
          <p>保存可复用的画面描述、生成模式、模型与参数组合。</p>
        </div>
        {presets.length ? <span className="surface-header__badge">{presets.length} 个配方</span> : null}
      </div>

      <div className="section-card section-card--flat preset-save-card">
        <div className="field">
          <label htmlFor="preset-name">新配方名称</label>
          <input
            id="preset-name"
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="例如：低饱和电影感 / 电商白底特写"
          />
        </div>
        <div className="button-row top-gap">
          <button
            className="button button--primary"
            type="button"
            onClick={onSaveCurrent}
            disabled={!canSaveCurrent}
          >
            保存当前创作配方
          </button>
        </div>
      </div>

      <div className="stack-list">
        {presets.length ? (
          presets.map((preset) => (
            <article key={preset.id} className="stack-card stack-card--asset">
              <div className="stack-card__header">
                <div>
                  <strong>{preset.name}</strong>
                  <p className="stack-card__meta">{preset.modelId || '未指定模型'} · {preset.size}</p>
                </div>
                <span>{preset.mode === 'mask' ? '遮罩编辑' : preset.mode === 'image' ? '图生图' : '文生图'}</span>
              </div>
              <p className="stack-card__prompt">{preset.prompt}</p>
              {pendingDeleteId === preset.id ? (
                <div className="inline-delete-confirmation" role="group" aria-label="删除配方确认">
                  <p>确认删除这份配方？</p>
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
                        onDelete(preset.id);
                        setPendingDeleteId(null);
                      }}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              ) : (
                <div className="button-row">
                  <button className="button button--ghost" type="button" onClick={() => onApply(preset)}>
                    应用到创作条
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => setPendingDeleteId(preset.id)}
                  >
                    删除
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="provider-list__empty">还没有保存创作配方，命名后即可把当前设置保存下来。</p>
        )}
      </div>
    </section>
  );
}
