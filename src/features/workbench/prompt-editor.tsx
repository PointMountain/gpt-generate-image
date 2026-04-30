interface PromptEditorProps {
  prompt: string;
  negativePrompt: string;
  onChangePrompt: (value: string) => void;
  onChangeNegativePrompt: (value: string) => void;
}

export function PromptEditor({
  prompt,
  negativePrompt,
  onChangePrompt,
  onChangeNegativePrompt,
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

      <div className="field">
        <label htmlFor="negative-prompt">负向提示词 <span>可选</span></label>
        <input
          id="negative-prompt"
          value={negativePrompt}
          onChange={(event) => onChangeNegativePrompt(event.target.value)}
          placeholder="低清晰度，水印，过度锐化"
        />
        <span className="field__hint">不同 provider 对负向提示词支持不完全一致。</span>
      </div>
    </div>
  );
}
