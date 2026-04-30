interface GenerationActionsProps {
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

export function GenerationActions({
  canGenerate,
  isGenerating,
  onGenerate,
  onClear,
}: GenerationActionsProps) {
  return (
    <div className="button-row">
      <button
        className="button button--primary"
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
      >
        {isGenerating ? '生成中…' : '生成图片'}
      </button>
      <button className="button button--ghost" type="button" onClick={onClear}>
        清空输入
      </button>
    </div>
  );
}
