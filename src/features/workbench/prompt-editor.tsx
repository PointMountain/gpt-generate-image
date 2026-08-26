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
          <label htmlFor="prompt-textarea">画面描述</label>
          <span>{prompt.length} / 3200</span>
        </div>
        <textarea
          id="prompt-textarea"
          lang="zh-CN"
          autoComplete="off"
          spellCheck={false}
          value={prompt}
          onChange={(event) => onChangePrompt(event.target.value)}
          maxLength={3200}
          placeholder="一台复古打字机放在旧木桌上，留出大块纸张留白，粗颗粒丝网印刷质感。"
        />
        <span className="field__hint">
          描述主体、环境、构图和质感；结果不满意时，再把上一张图加入输入素材继续创作。
        </span>
      </div>
    </div>
  );
}
