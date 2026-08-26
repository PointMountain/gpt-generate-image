import type { GenerationMode } from '../../lib/openai/ai-sdk-image-client';

interface MaskImageDropzoneProps {
  mode: GenerationMode;
  previewUrl: string;
  fileName: string;
  onSelectFile: (file: File | null) => void;
  onClear: () => void;
}

export function MaskImageDropzone({
  mode,
  previewUrl,
  fileName,
  onSelectFile,
  onClear,
}: MaskImageDropzoneProps) {
  if (mode !== 'mask') {
    return null;
  }

  return (
    <div className="reference-dropzone-card">
      <div className="list-header list-header--compact">
        <div>
          <h3>Mask</h3>
          <p>上传一张 mask 文件，透明区域将作为可编辑区域发送给 OpenAI。</p>
        </div>
        {previewUrl ? <span className="provider-tag">Mask 已附加</span> : null}
      </div>

      <div className="reference-dropzone">
        {previewUrl ? (
          <div className="reference-dropzone__preview">
            <img src={previewUrl} alt="Mask 预览" />
            <div>
              <strong className="reference-dropzone__file-name" title={fileName || undefined}>
                {fileName || '已载入 mask'}
              </strong>
              <p>mask 会随源图一起发送。</p>
              <div className="button-row">
                <label className="button button--ghost">
                  替换 mask
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
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
            <strong>选择 mask</strong>
            <span>首版只支持上传，不内置绘制器。</span>
          </label>
        )}
      </div>
    </div>
  );
}
