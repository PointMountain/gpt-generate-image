import { useEffect, useRef, useState } from 'react';

const API_KEY_REGISTRATION_URL = 'https://codex.pingchela.xyz/register?aff=4L2D7UE2FAM3';

interface GuideVideoModalProps {
  open: boolean;
  onClose: () => void;
}

export function GuideVideoModal({ open, onClose }: GuideVideoModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setCopyStatus('idle');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const returnFocusTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], video[controls]',
      ));
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      videoRef.current?.pause();
      returnFocusTarget?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const copyRegistrationLink = async () => {
    const copyWithSelection = () => {
      const input = document.createElement('textarea');
      input.value = API_KEY_REGISTRATION_URL;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) {
        throw new Error('Copy command was rejected.');
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(API_KEY_REGISTRATION_URL);
        } catch {
          copyWithSelection();
        }
      } else {
        copyWithSelection();
      }
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="guide-video-modal" role="dialog" aria-modal="true" aria-label="使用指南">
      <button
        className="guide-video-modal__backdrop"
        type="button"
        tabIndex={-1}
        aria-label="关闭使用指南遮罩"
        onClick={onClose}
      />
      <div ref={dialogRef} className="guide-video-modal__sheet">
        <header className="guide-video-modal__header">
          <div>
            <p>GET STARTED / 01:17</p>
            <h2>1 分 17 秒完成首次连接</h2>
            <span id="guide-video-description">注册账号、创建 API Key，再回到造境拉取模型开始创作。</span>
          </div>
          <button
            ref={closeButtonRef}
            className="guide-video-modal__close"
            type="button"
            onClick={onClose}
            aria-label="关闭使用指南"
          >
            ×
          </button>
        </header>

        <div className="guide-video-modal__steps" aria-label="视频内容">
          <span><b>01</b> 注册账号</span>
          <span><b>02</b> 创建密钥</span>
          <span><b>03</b> 连接造境</span>
        </div>

        <section className="guide-video-modal__access" aria-label="API Key 获取链接">
          <div className="guide-video-modal__url">
            <strong>获取 API Key</strong>
          </div>
          <div className="guide-video-modal__actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => void copyRegistrationLink()}
              aria-label="复制注册链接"
            >
              <span aria-live="polite">
                {copyStatus === 'copied' ? '已复制 ✓' : copyStatus === 'failed' ? '复制失败，请重试' : '复制链接'}
              </span>
            </button>
            <a
              className="button button--primary"
              href={API_KEY_REGISTRATION_URL}
              target="_blank"
              rel="noreferrer"
            >
              打开链接，获取 API Key
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <div className="guide-video-modal__player">
          <video
            ref={videoRef}
            aria-label="中转站与绘图平台使用指南"
            aria-describedby="guide-video-description"
            controls
            playsInline
            preload="metadata"
            poster="/tokencanvas-guide-poster.webp"
            src="/tokencanvas-guide.mp4"
          >
            当前浏览器不支持视频播放，请使用页面中的链接获取 API Key。
          </video>
        </div>

      </div>
    </div>
  );
}
