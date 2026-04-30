interface LoadingStateProps {
  title?: string;
  body?: string;
}

export function LoadingState({
  title = '处理中',
  body = '正在与 provider 通信，请稍候。',
}: LoadingStateProps) {
  return (
    <div className="status-block status-block--loading" role="status" aria-live="polite">
      <span className="status-spinner" aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}
