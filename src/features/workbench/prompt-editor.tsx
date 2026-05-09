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
        <label htmlFor="prompt-textarea">正向提示词</label>
        <textarea
          id="prompt-textarea"
          value={prompt}
          onChange={(event) => onChangePrompt(event.target.value)}
          placeholder="例如：暮色中的海边温室，湿润玻璃，电影灯光，细节丰富，低饱和胶片感"
        />
        <span className="field__hint">
          尽量写清主体、场景、镜头、光线和材质。
        </span>
      </div>
    </div>
  );
}
