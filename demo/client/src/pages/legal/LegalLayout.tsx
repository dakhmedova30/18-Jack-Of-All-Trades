import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** A plain, public page for Terms and Privacy: reachable logged in or out. */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <Link to="/" className="legal-page__brand">
          Jack-Of-All-Trades
        </Link>
        <nav aria-label="Legal" className="legal-page__nav">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </header>
      <main className="legal-page__body">
        <h1>{title}</h1>
        <p className="muted">
          Draft for a course project, not legal advice. Last updated October 29, 2026.
        </p>
        {children}
        <p>
          <Link to="/">← Back to the app</Link>
        </p>
      </main>
    </div>
  );
}
