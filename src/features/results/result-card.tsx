import type { ResultImage } from '../history/history-types';

interface ResultCardProps {
  image: ResultImage;
  index: number;
  onPreview: (image: ResultImage) => void;
  onDownload: (image: ResultImage, index: number) => void;
  onUseAsReference: (image: ResultImage) => void;
}

export function ResultCard({
  image,
  index,
  onPreview,
  onDownload,
  onUseAsReference,
}: ResultCardProps) {
  const label = `生成结果 ${index + 1}`;

  return (
    <article className="result-card">
      <button
        type="button"
        className="result-card__visual"
        onClick={() => onPreview(image)}
        aria-label={`预览${label}`}
      >
        <img src={image.src} alt={label} />
      </button>

      <div className="result-card__body">
        <div>
          <p className="result-card__eyebrow">Result {index + 1}</p>
          <h4>{label}</h4>
          {image.width && image.height ? (
            <p className="result-card__meta">
              {image.width} × {image.height}
              {image.dimensionStatus === 'resized' ? ' · 本地校准' : null}
              {image.dimensionStatus === 'mismatched' ? ' · 端点尺寸不符' : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="result-card__actions" aria-label={`${label}操作`}>
        <button className="button button--primary" type="button" onClick={() => onPreview(image)}>
          预览
        </button>
        <button className="button button--ghost" type="button" onClick={() => onDownload(image, index)}>
          下载
        </button>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => onUseAsReference(image)}
        >
          继续创作
        </button>
      </div>
    </article>
  );
}
