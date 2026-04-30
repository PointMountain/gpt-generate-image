import type { ReactNode } from 'react';

interface WorkbenchFrameProps {
  gallery: ReactNode;
  composer: ReactNode;
  rail: ReactNode;
  support?: ReactNode;
}

export function WorkbenchFrame({
  gallery,
  composer,
  rail,
  support,
}: WorkbenchFrameProps) {
  return (
    <div className="workbench-frame">
      <section className="workbench-frame__gallery">{gallery}</section>
      <section className="workbench-frame__composer">{composer}</section>
      <aside className="workbench-frame__rail">{rail}</aside>
      {support ? <section className="workbench-frame__support">{support}</section> : null}
    </div>
  );
}
