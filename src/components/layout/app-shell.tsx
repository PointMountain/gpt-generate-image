import type { PropsWithChildren, ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  masthead?: ReactNode;
  footer?: ReactNode;
}

export function AppShell({ masthead, footer, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__grain" aria-hidden="true" />
      <div className="app-shell__container">
        {masthead ? <header className="app-shell__masthead">{masthead}</header> : null}
        <main className="app-shell__main">{children}</main>
        {footer ? <footer className="app-shell__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
