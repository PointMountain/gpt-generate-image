import type { ReactNode } from 'react';

interface WorkbenchFrameProps {
  commandBar?: ReactNode;
  gallery: ReactNode;
  composer: ReactNode;
  rail: ReactNode;
  support?: ReactNode;
}

export function WorkbenchFrame({
  commandBar,
  gallery,
  composer,
  rail,
  support,
}: WorkbenchFrameProps) {
  return (
    <div className="workbench-frame">
      {commandBar ? <section className="workbench-frame__command">{commandBar}</section> : null}
      <section className="workbench-frame__composer">{composer}</section>
      <section className="workbench-frame__gallery">{gallery}</section>
      <aside className="workbench-frame__rail">{rail}</aside>
      {support ? <section className="workbench-frame__support">{support}</section> : null}
    </div>
  );
}
