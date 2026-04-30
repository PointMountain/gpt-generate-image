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
  return (
    <section>
      <div className="section-heading">
        <div>
          <h3>预设模板</h3>
          <p>把常用提示词和参数组合存下来，下次直接复用。</p>
        </div>
      </div>

      <div className="section-card section-card--flat">
        <div className="field">
          <label htmlFor="preset-name">新预设名称</label>
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
            保存当前设置
          </button>
        </div>
      </div>

      <div className="stack-list">
        {presets.length ? (
          presets.map((preset) => (
            <article key={preset.id} className="stack-card">
              <div className="stack-card__header">
                <strong>{preset.name}</strong>
                <span>{preset.modelId || '未指定模型'}</span>
              </div>
              <p className="stack-card__prompt">{preset.prompt}</p>
              <div className="button-row">
                <button className="button button--ghost" type="button" onClick={() => onApply(preset)}>
                  应用
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => onDelete(preset.id)}
                >
                  删除
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="provider-list__empty">还没有保存模板。</p>
        )}
      </div>
    </section>
  );
}
