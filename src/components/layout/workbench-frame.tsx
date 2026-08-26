import type { ReactNode } from 'react';

interface WorkbenchFrameProps {
  brandRail: ReactNode;
  composer: ReactNode;
  canvas: ReactNode;
  mobileHeader?: ReactNode;
  mobileNavigation?: ReactNode;
  overlay?: ReactNode;
}

export function WorkbenchFrame({
  brandRail,
  composer,
  canvas,
  mobileHeader,
  mobileNavigation,
  overlay,
}: WorkbenchFrameProps) {
  return (
    <div className="workbench-frame">
      {mobileHeader ? <header className="workbench-frame__mobile-header">{mobileHeader}</header> : null}
      <aside className="workbench-frame__brand">{brandRail}</aside>
      <section className="workbench-frame__composer">{composer}</section>
      <section className="workbench-frame__canvas">{canvas}</section>
      {mobileNavigation ? (
        <nav className="workbench-frame__mobile-nav" aria-label="移动端主导航">
          {mobileNavigation}
        </nav>
      ) : null}
      {overlay}
    </div>
  );
}
