import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ANALYTICS_SECTIONS, type AnalyticsSectionSlug } from './analyticsSections';

interface AnalyticsSubpageProps {
  slug: AnalyticsSectionSlug;
  /** Controls for the top right of the page, e.g. the chart timeframe. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The frame every deeper Analytics page shares: a link back to Analytics, then its title, with
 * any `actions` at the top right.
 */
export function AnalyticsSubpage({ slug, actions, children }: AnalyticsSubpageProps) {
  const section = ANALYTICS_SECTIONS.find((s) => s.slug === slug)!;

  return (
    <section className="page">
      <div className="analytics-subpage__header">
        <div>
          <p>
            <Link to="/analytics">← Analytics</Link>
          </p>
          <h1>{section.title}</h1>
          <p className="muted">{section.description}</p>
        </div>
        {actions && <div className="analytics-subpage__actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
