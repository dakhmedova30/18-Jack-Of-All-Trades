import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDownIcon } from './icons';
import { SIDEBAR_NAV_ITEMS } from './sidebarNavItems';

interface SidebarNavProps {
  /** The collapsed rail: icons only, and no drop-downs. */
  compact?: boolean;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar__link${isActive ? ' is-active' : ''}`;

/** The items whose drop-down holds the page at `pathname`. */
function itemsContaining(pathname: string): string[] {
  return SIDEBAR_NAV_ITEMS.filter((item) =>
    item.children?.some((child) => pathname.startsWith(child.to)),
  ).map((item) => item.to);
}

export function SidebarNav({ compact = false }: SidebarNavProps) {
  const { pathname } = useLocation();
  // The sidebar stays mounted between pages, so open the drop-down holding the current page
  // whenever the page changes (e.g. from a card on Analytics); the arrow toggles it after that.
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set(itemsContaining(pathname)));
  const [openedFor, setOpenedFor] = useState(pathname);
  if (openedFor !== pathname) {
    setOpenedFor(pathname);
    const containing = itemsContaining(pathname);
    if (containing.some((to) => !openItems.has(to))) {
      setOpenItems((current) => new Set([...current, ...containing]));
    }
  }

  function toggle(to: string) {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(to)) next.delete(to);
      else next.add(to);
      return next;
    });
  }

  return (
    <nav className="sidebar__nav" aria-label="Main">
      {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: NavIcon, end, children }) => {
        const link = (
          <NavLink
            to={to}
            end={end}
            title={compact ? label : undefined}
            aria-label={compact ? label : undefined}
            // On one of its sub-pages the item stays highlighted, but only marks the section
            // the current page is in; the sub-link is the current page.
            aria-current={children && pathname !== to ? 'true' : 'page'}
            className={linkClass}
          >
            <NavIcon />
            <span className="sidebar__link-label">{label}</span>
          </NavLink>
        );
        if (!children || compact) return <div key={to}>{link}</div>;

        const open = openItems.has(to);
        return (
          <div key={to} className="sidebar__group">
            <div className="sidebar__group-head">
              {link}
              <button
                type="button"
                className="sidebar__expand"
                onClick={() => toggle(to)}
                aria-expanded={open}
                aria-controls={`sidebar-sub-${label}`}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
              >
                <ChevronDownIcon className={open ? 'is-open' : undefined} />
              </button>
            </div>
            {open && (
              <div className="sidebar__sub" id={`sidebar-sub-${label}`}>
                {children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    aria-label={child.ariaLabel}
                    className={({ isActive }) => `sidebar__sublink${isActive ? ' is-active' : ''}`}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
