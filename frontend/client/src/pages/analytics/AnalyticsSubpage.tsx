import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ANALYTICS_SECTIONS, type AnalyticsSectionSlug } from './analyticsSections';

interface AnalyticsSubpageProps {
  slug: AnalyticsSectionSlug;
  children: ReactNode;
}

/** The frame every deeper Analytics page shares: a link back to Analytics, then its title. */
export function AnalyticsSubpage({ slug, children }: AnalyticsSubpageProps) {
  const section = ANALYTICS_SECTIONS.find((s) => s.slug === slug)!;

  return (
    <section className="page">
      <div>
        <p>
          <Link to="/analytics">← Analytics</Link>
        </p>
        <h1>{section.title}</h1>
        <p className="muted">{section.description}</p>
      </div>
      {children}
    </section>
  );
}
