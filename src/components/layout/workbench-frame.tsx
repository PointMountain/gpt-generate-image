import type { PropsWithChildren, ReactNode } from 'react';

interface WorkbenchFrameProps extends PropsWithChildren {
  sidebar: ReactNode;
  lowerPanel?: ReactNode;
}

export function WorkbenchFrame({
  sidebar,
  lowerPanel,
  children,
}: WorkbenchFrameProps) {
  return (
    <div className="workbench-frame">
      <div className="workbench-frame__main-column">
        <section className="workbench-frame__hero">{children}</section>
        {lowerPanel ? <section className="workbench-frame__lower">{lowerPanel}</section> : null}
      </div>
      <aside className="workbench-frame__sidebar">{sidebar}</aside>
    </div>
  );
}
