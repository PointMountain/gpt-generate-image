interface ToastRegionProps {
  message: string | null;
}

export function ToastRegion({ message }: ToastRegionProps) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {message ? <div className="toast-region__toast">{message}</div> : null}
    </div>
  );
}
