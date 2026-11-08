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

export function SidebarNav({ compact = false }: SidebarNavProps) {
  const { pathname } = useLocation();
  // Open on load when the current page is under the item; the arrow toggles it after that.
  const [openItems, setOpenItems] = useState<Set<string>>(
    () =>
      new Set(
        SIDEBAR_NAV_ITEMS.filter((item) =>
          item.children?.some((child) => pathname.startsWith(child.to)),
        ).map((item) => item.to),
      ),
  );

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
                    className={({ isActive }) =>
                      `sidebar__sublink${isActive ? ' is-active' : ''}`
                    }
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
