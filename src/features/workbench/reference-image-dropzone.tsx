import type { GenerationMode, ImageReferenceInput } from '../../lib/openai/ai-sdk-image-client';

interface ReferenceImageDropzoneProps {
  mode: GenerationMode;
  referenceImages: ImageReferenceInput[];
  supportsReferenceImages: boolean;
  onModeChange: (mode: GenerationMode) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (previewUrl: string) => void;
}

export function ReferenceImageDropzone({
  mode,
  referenceImages,
  supportsReferenceImages,
  onModeChange,
  onAddFiles,
  onRemove,
}: ReferenceImageDropzoneProps) {
  const hasReferenceImage = mode !== 'text' && referenceImages.length > 0;

  return (
    <div className="reference-dropzone-card">
      <div className="list-header list-header--compact">
        <div>
          <h3>生成模式</h3>
          <p>{hasReferenceImage ? '输入素材已经进入下一次创作。' : '从文字开始，或切到图生图继续迭代。'}</p>
        </div>
        {hasReferenceImage ? <span className="provider-tag">带素材创作</span> : null}
      </div>

      <div className="button-row composer-mode-row" role="group" aria-label="生成模式">
        <button
          type="button"
          className={`button mode-button ${mode === 'text' ? 'button--primary' : 'button--ghost'}`}
          aria-pressed={mode === 'text'}
          onClick={() => onModeChange('text')}
        >
          纯文生图
        </button>
        <button
          type="button"
          className={`button mode-button ${mode === 'image' ? 'button--primary' : 'button--ghost'}`}
          aria-pressed={mode === 'image'}
          onClick={() => onModeChange('image')}
          disabled={!supportsReferenceImages}
        >
          图生图
        </button>
        <button
          type="button"
          className={`button mode-button ${mode === 'mask' ? 'button--primary' : 'button--ghost'}`}
          aria-pressed={mode === 'mask'}
          onClick={() => onModeChange('mask')}
          disabled={!supportsReferenceImages}
        >
          遮罩编辑
        </button>
      </div>

      {supportsReferenceImages && mode !== 'text' ? (
        <div className="reference-dropzone">
          {referenceImages.length ? (
            <div className="reference-dropzone__preview">
              <div className="reference-dropzone__thumb-grid">
                {referenceImages.map((reference) => (
                  <span key={reference.previewUrl} className="reference-dropzone__thumb">
                    <img src={reference.previewUrl} alt="输入素材预览" />
                    <button type="button" onClick={() => onRemove(reference.previewUrl)}>移除</button>
                  </span>
                ))}
              </div>
              <div>
                <strong>{referenceImages.length} 张输入素材</strong>
                <p>最多 16 张，会随下一次图生图或遮罩编辑发送。</p>
                <label className="button button--ghost">
                  添加图片
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => onAddFiles(Array.from(event.target.files ?? []))}
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="reference-dropzone__empty">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => onAddFiles(Array.from(event.target.files ?? []))}
              />
              <strong>选择输入素材</strong>
              <span>也可以从结果或创作历史直接加入。</span>
            </label>
          )}
        </div>
      ) : !supportsReferenceImages ? (
        <p className="field__hint">
          当前图片模型暂未启用输入素材模式。
        </p>
      ) : null}
    </div>
  );
}
