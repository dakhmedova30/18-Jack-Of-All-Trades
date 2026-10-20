import { Link } from 'react-router-dom';
import { HomeLayout } from '../components/HomeLayout';

const DASHBOARDS = [
  { to: '/sales', title: 'Sales', graphic: 'table' },
  { to: '/inventory', title: 'Inventory', graphic: 'table' },
  { to: '/expenses', title: 'Expenses', graphic: 'table' },
  { to: '/analytics', title: 'Analytics', graphic: 'chart' },
] as const;

export function HomePage() {
  return (
    <HomeLayout>
      <section className="page home">
        <h1>Welcome back</h1>
        <p className="muted">Pick a dashboard to get started.</p>
        <div className="home-cards">
          {DASHBOARDS.map(({ to, title, graphic }) => (
            <Link key={to} to={to} className="home-card">
              <h2 className="home-card__title">{title}</h2>
              <div className="home-card__preview">
                {graphic === 'table' ? <TablePreview /> : <ChartPreview />}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </HomeLayout>
  );
}

/** Decorative stand-in for a toolbar + search + table dashboard (Sales, Inventory). */
function TablePreview() {
  return (
    <svg viewBox="0 0 240 140" role="presentation" aria-hidden="true" className="home-card__svg">
      <rect x="10" y="10" width="38" height="14" rx="4" fill="var(--color-primary)" />
      <rect x="52" y="10" width="52" height="14" rx="4" fill="#4a4a4a" />
      <rect x="168" y="10" width="62" height="14" rx="7" fill="var(--color-search)" />
      <line
        x1="10"
        y1="36"
        x2="230"
        y2="36"
        stroke="var(--color-border-strong)"
        strokeWidth="1.5"
      />
      {[48, 64, 80, 96, 112].map((y, i) => (
        <g key={y}>
          <rect
            x="10"
            y={y}
            width={i % 2 === 0 ? 150 : 110}
            height="6"
            rx="3"
            fill="var(--color-border)"
          />
          <rect x="214" y={y} width="16" height="6" rx="3" fill="var(--color-border)" />
        </g>
      ))}
    </svg>
  );
}

/** Decorative stand-in for the Analytics dashboard (chart + stat tiles). */
function ChartPreview() {
  return (
    <svg viewBox="0 0 240 140" role="presentation" aria-hidden="true" className="home-card__svg">
      <rect x="10" y="10" width="150" height="120" rx="6" fill="var(--color-surface)" />
      <polyline
        points="22,96 50,60 78,84 106,48 134,70 150,38"
        fill="none"
        stroke="#2a78d6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[22, 50, 78, 106, 134, 150].map((x, i) => (
        <circle key={x} cx={x} cy={[96, 60, 84, 48, 70, 38][i]} r="3" fill="#2a78d6" />
      ))}
      <rect x="168" y="10" width="62" height="34" rx="5" fill="#dcefdc" />
      <rect x="168" y="50" width="62" height="34" rx="5" fill="var(--color-search)" />
      <rect x="168" y="90" width="62" height="34" rx="5" fill="var(--color-search)" />
    </svg>
  );
}
