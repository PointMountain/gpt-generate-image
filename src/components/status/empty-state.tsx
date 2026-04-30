interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  body: string;
}

export function EmptyState({ eyebrow, title, body }: EmptyStateProps) {
  return (
    <div className="status-block status-block--empty">
      {eyebrow ? <p className="status-block__eyebrow">{eyebrow}</p> : null}
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
