import { useEffect, useRef } from 'react';
import type { ResultImage } from '../history/history-types';

interface ResultPreviewModalProps {
  image: ResultImage | null;
  onClose: () => void;
}

export function ResultPreviewModal({ image, onClose }: ResultPreviewModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!image) {
      return undefined;
    }

    const returnFocusTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusTarget?.focus();
    };
  }, [image]);

  if (!image) {
    return null;
  }

  return (
    <div className="preview-modal" role="dialog" aria-modal="true" aria-label="结果预览">
      <button
        className="preview-modal__backdrop"
        type="button"
        tabIndex={-1}
        aria-label="关闭结果预览遮罩"
        onClick={onClose}
      />
      <div className="preview-modal__content">
        <button
          ref={closeButtonRef}
          className="button button--ghost preview-modal__close"
          type="button"
          onClick={onClose}
        >
          关闭
        </button>
        <img src={image.src} alt="结果大图预览" />
      </div>
    </div>
  );
}
