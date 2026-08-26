interface LoadingStateProps {
  title?: string;
  body?: string;
}

export function LoadingState({
  title = '处理中',
  body = '正在与 OpenAI 通信，请稍候。',
}: LoadingStateProps) {
  return (
    <div className="status-block status-block--loading" role="status" aria-live="polite">
      <span className="status-loading__tape" aria-hidden="true" />
      <div className="status-loading__mark" aria-hidden="true">
        <span>绘</span>
        <i />
      </div>
      <div className="status-loading__copy">
        <p className="status-loading__eyebrow">画布正在显影</p>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="status-loading__steps" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
