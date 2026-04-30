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
  return (
    <div className="section-card">
      <div className="list-header">
        <div>
          <h3>参考图</h3>
          <p>可上传本地图片，也可以直接复用结果区里的图片。</p>
        </div>
        <div className="button-row">
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
      </div>

      {supportsReferenceImages ? (
        <div className="reference-dropzone">
          {previewUrl ? (
            <div className="reference-dropzone__preview">
              <img src={previewUrl} alt="参考图预览" />
              <div>
                <strong>{fileName || '已载入参考图'}</strong>
                <p>下次图生图会把这张图片一起发送给 provider。</p>
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
              <strong>选择图片</strong>
              <span>支持本地上传，也可以从结果或历史直接复用。</span>
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
