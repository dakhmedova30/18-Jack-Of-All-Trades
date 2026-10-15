import type { ReactNode } from 'react';

/**
 * Home's own shell: logo only, no nav links. Once you click into a dashboard,
 * AppLayout takes over with the full sidebar nav so you never have to come back
 * here to switch pages.
 */
export function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__logo">Jack-Of-All-Trades</div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
