import type { ReactNode } from 'react';

interface SummaryPanelProps {
  title: string;
  context?: ReactNode;
  children: ReactNode;
}

export function SummaryPanel({ title, context, children }: SummaryPanelProps) {
  return (
    <section className="card summary-panel">
      <header className="summary-panel__header">
        <h2>{title}</h2>
        {context && <span className="summary-panel__context">{context}</span>}
      </header>
      <div className="summary-panel__body">{children}</div>
    </section>
  );
}
