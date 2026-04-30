interface ErrorDetailDrawerProps {
  summary: string;
  detail?: string;
}

export function ErrorDetailDrawer({ summary, detail }: ErrorDetailDrawerProps) {
  return (
    <details className="error-detail-drawer">
      <summary>{summary}</summary>
      {detail ? <pre>{detail}</pre> : <p>当前 provider 没有返回更多诊断信息。</p>}
    </details>
  );
}
