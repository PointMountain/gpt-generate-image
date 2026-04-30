import type { ResultImage } from '../history/history-types';

interface ResultPreviewModalProps {
  image: ResultImage | null;
  onClose: () => void;
}

export function ResultPreviewModal({ image, onClose }: ResultPreviewModalProps) {
  if (!image) {
    return null;
  }

  return (
    <div className="preview-modal" role="dialog" aria-modal="true" aria-label="结果预览">
      <button className="preview-modal__backdrop" type="button" onClick={onClose} />
      <div className="preview-modal__content">
        <button className="button button--ghost preview-modal__close" type="button" onClick={onClose}>
          关闭
        </button>
        <img src={image.src} alt="结果大图预览" />
      </div>
    </div>
  );
}
