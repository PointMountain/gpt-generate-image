interface ReferenceImageDropzoneProps {
  mode: 'text' | 'reference';
  previewUrl: string;
  fileName: string;
  supportsReferenceImages: boolean;
  onModeChange: (mode: 'text' | 'reference') => void;
  onSelectFile: (file: File | null) => void;
  onClear: () => void;
}

export function ReferenceImageDropzone({
  mode,
  previewUrl,
  fileName,
  supportsReferenceImages,
  onModeChange,
  onSelectFile,
  onClear,
}: ReferenceImageDropzoneProps) {
  const hasReferenceImage = mode === 'reference' && Boolean(previewUrl);

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
          className={`button ${mode === 'reference' ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onModeChange('reference')}
          disabled={!supportsReferenceImages}
        >
          图生图
        </button>
      </div>

      {supportsReferenceImages ? (
        <div className="reference-dropzone">
          {previewUrl ? (
            <div className="reference-dropzone__preview">
              <img src={previewUrl} alt="参考图预览" />
              <div>
                <strong>{fileName || '已载入参考图'}</strong>
                <p>这张图片会随下一次图生图请求发送。</p>
                <div className="button-row">
                  <label className="button button--ghost">
                    替换图片
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) =>
                        onSelectFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <button className="button button--danger" type="button" onClick={onClear}>
                    清除
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <label className="reference-dropzone__empty">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
              />
              <strong>选择参考图</strong>
              <span>也可以从结果或历史直接复用。</span>
            </label>
          )}
        </div>
      ) : (
        <p className="field__hint">
          当前 provider 被标记为不支持参考图，若实际支持可在兼容回退中手动打开。
        </p>
      )}
    </div>
  );
}
