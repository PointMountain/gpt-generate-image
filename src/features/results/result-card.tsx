import type { ResultImage } from '../history/history-types';

interface ResultCardProps {
  image: ResultImage;
  index: number;
  onPreview: (image: ResultImage) => void;
  onDownload: (image: ResultImage, index: number) => void;
  onUseAsReference: (image: ResultImage) => void;
  onReusePrompt: () => void;
}

export function ResultCard({
  image,
  index,
  onPreview,
  onDownload,
  onUseAsReference,
  onReusePrompt,
}: ResultCardProps) {
  return (
    <article className="result-card">
      <button type="button" className="result-card__visual" onClick={() => onPreview(image)}>
        <img src={image.src} alt={`生成结果 ${index + 1}`} />
      </button>

      <div className="result-card__actions">
        <button className="button button--ghost" type="button" onClick={() => onPreview(image)}>
          预览
        </button>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => onDownload(image, index)}
        >
          下载
        </button>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => onUseAsReference(image)}
        >
          设为参考图
        </button>
        <button className="button button--ghost" type="button" onClick={onReusePrompt}>
          复用提示词
        </button>
      </div>
    </article>
  );
}
