import type { DiscoveryState } from './provider-types';

interface ModelSelectorProps {
  discoveryState: DiscoveryState;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onRefresh: () => void;
}

export function ModelSelector({
  discoveryState,
  selectedModelId,
  onSelectModel,
  onRefresh,
}: ModelSelectorProps) {
  const hasDiscoveredModels = discoveryState.models.length > 0;

  return (
    <div className="section-card">
      <div className="list-header">
        <div>
          <h3>模型选择</h3>
          <p>{discoveryState.message ?? '测试连接后会在这里列出当前 key 可见的模型。'}</p>
        </div>
        <button className="button button--ghost" type="button" onClick={onRefresh}>
          刷新
        </button>
      </div>

      <div className="field">
        <label htmlFor="model-select">当前模型</label>
        <select
          id="model-select"
          value={selectedModelId}
          onChange={(event) => onSelectModel(event.target.value)}
          disabled={!hasDiscoveredModels}
        >
          {!hasDiscoveredModels ? (
            <option value="">暂无发现结果</option>
          ) : (
            discoveryState.models.map((model) => {
              const likely = discoveryState.likelyModelIds.includes(model.id);
              return (
                <option key={model.id} value={model.id}>
                  {likely ? `推荐 · ${model.label}` : model.label}
                </option>
              );
            })
          )}
        </select>
        <span className="field__hint">
          如果自动探测不完整，可在兼容回退中手填模型名并跳过发现。
        </span>
      </div>
    </div>
  );
}
