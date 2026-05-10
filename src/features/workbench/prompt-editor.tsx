interface PromptEditorProps {
  prompt: string;
  onChangePrompt: (value: string) => void;
}

export function PromptEditor({
  prompt,
  onChangePrompt,
}: PromptEditorProps) {
  return (
    <div className="prompt-editor">
      <div className="field field--prompt">
        <div className="field__label-row">
          <label htmlFor="prompt-textarea">正向提示词</label>
          <span>主体、场景、光线、材质</span>
        </div>
        <textarea
          id="prompt-textarea"
          lang="zh-CN"
          autoComplete="off"
          spellCheck={false}
          value={prompt}
          onChange={(event) => onChangePrompt(event.target.value)}
          placeholder="暮色中的海边温室，湿润玻璃，电影灯光，细节丰富，低饱和胶片感"
        />
        <span className="field__hint">
          结果不满意时，先改这里，再把上一张图设为参考图继续迭代。
        </span>
      </div>
    </div>
  );
}
