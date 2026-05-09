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
          <h3>模式</h3>
          <p>{hasReferenceImage ? '下次生成会带上参考图。' : '文生图优先，必要时附加参考图。'}</p>
        </div>
        {hasReferenceImage ? <span className="provider-tag">参考图请求</span> : null}
      </div>

      <div className="button-row composer-mode-row">
        <button
          type="button"
          className={`button ${mode === 'text' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onModeChange('text')}
        >
          纯文生图
        </button>
        <button
          type="button"
          className={`button ${mode === 'image' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onModeChange('image')}
          disabled={!supportsReferenceImages}
        >
          图生图
        </button>
        <button
          type="button"
          className={`button ${mode === 'mask' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onModeChange('mask')}
          disabled={!supportsReferenceImages}
        >
          遮罩编辑
        </button>
      </div>

      {supportsReferenceImages ? (
        <div className="reference-dropzone">
          {referenceImages.length ? (
            <div className="reference-dropzone__preview">
              <div className="reference-dropzone__thumb-grid">
                {referenceImages.map((reference) => (
                  <span key={reference.previewUrl} className="reference-dropzone__thumb">
                    <img src={reference.previewUrl} alt="参考图预览" />
                    <button type="button" onClick={() => onRemove(reference.previewUrl)}>移除</button>
                  </span>
                ))}
              </div>
              <div>
                <strong>{referenceImages.length} 张参考图</strong>
                <p>最多 16 张，会随下一次图生图或 mask 请求发送。</p>
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
              <strong>选择参考图</strong>
              <span>也可以从结果或历史直接复用。</span>
            </label>
          )}
        </div>
      ) : (
        <p className="field__hint">
          当前 OpenAI 图片模型暂未启用参考图模式。
        </p>
      )}
    </div>
  );
}
