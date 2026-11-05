import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import type { AppNotification } from '../types';
import { describeUserAgent } from '../utils/userAgent';
import { FOCUSABLE } from './focusable';
import { BellIcon } from './icons';

type Position = { top?: number; bottom?: number; left?: number; right?: number };

const MENU_GAP = 8;
/** Keep in step with .notification-panel's width in styles.css (22rem at 16px). */
const PANEL_WIDTH = 352;

/** The text to show for an alert; a new-device alert names the device. */
function describe(alert: AppNotification): string {
  if (alert.type === 'new-device') {
    const when = alert.at
      ? ` on ${new Date(alert.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
      : '';
    return `${describeUserAgent(alert.userAgent)} logged in${when}, a device you haven't used before.`;
  }
  return alert.message;
}

/**
 * The bell in the sidebar: a count of current alerts, and a panel listing them. The panel is
 * rendered into <body> and positioned by hand, like the account menu, because the phone top bar
 * clips overflow.
 */
export function NotificationBell() {
  const { alerts, dismiss, dismissAll } = useNotifications();
  const navigate = useNavigate();
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  function moveFocusFromButton(backwards: boolean) {
    const focusable = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) =>
        !panelRef.current?.contains(element) &&
        !element.closest('[inert], [aria-hidden="true"]') &&
        element.getClientRects().length > 0,
    );
    const buttonIndex = buttonRef.current ? focusable.indexOf(buttonRef.current) : -1;
    if (buttonIndex < 0 || focusable.length === 0) return;
    const nextIndex = (buttonIndex + (backwards ? -1 : 1) + focusable.length) % focusable.length;
    focusable[nextIndex]?.focus();
  }

  function toggle() {
    if (open) return setPosition(null);
    const rect = buttonRef.current!.getBoundingClientRect();
    // The bell is at the top of the sidebar, so the panel opens below it, lined up with its left
    // edge (over the page, not the sidebar) and pulled back in if it would run off the screen.
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * MENU_GAP);
    setPosition({
      top: rect.bottom + MENU_GAP,
      left: Math.max(MENU_GAP, Math.min(rect.left, window.innerWidth - width - MENU_GAP)),
    });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      panelRef.current?.contains(document.activeElement) ||
      (document.activeElement !== buttonRef.current && document.activeElement !== document.body)
    ) {
      return;
    }
    const firstButton =
      panelRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    (firstButton ?? panelRef.current)?.focus();
  }, [open, alerts.length]);

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ].filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      focusable.length === 0 ||
      (event.shiftKey &&
        (document.activeElement === first || document.activeElement === panelRef.current)) ||
      (!event.shiftKey &&
        (document.activeElement === last || document.activeElement === panelRef.current))
    ) {
      event.preventDefault();
      setPosition(null);
      moveFocusFromButton(event.shiftKey);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="sidebar__bell"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={alerts.length > 0 ? `Notifications, ${alerts.length} new` : 'Notifications'}
      >
        <BellIcon />
        {alerts.length > 0 && <span className="notification-badge">{alerts.length}</span>}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="notification-panel"
            role="dialog"
            aria-label="Notifications"
            tabIndex={-1}
            style={position}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="notification-panel__header">
              <strong>Notifications</strong>
              {alerts.length > 1 && (
                <button type="button" className="notification-panel__link" onClick={dismissAll}>
                  Dismiss all
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="muted notification-panel__empty">You're all caught up.</p>
            ) : (
              <ul className="notification-panel__list">
                {alerts.map((alert) => (
                  <li key={`${alert.type}:${alert.fingerprint}`} className="notification-item">
                    <div className="notification-item__body">
                      <strong>{alert.title}</strong>
                      <span>{describe(alert)}</span>
                      <button
                        type="button"
                        className="notification-panel__link"
                        onClick={() => {
                          setPosition(null);
                          navigate(alert.link);
                        }}
                      >
                        View
                      </button>
                    </div>
                    <button
                      type="button"
                      className="notification-item__dismiss"
                      aria-label={`Dismiss ${alert.title}`}
                      onClick={() => dismiss(alert)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
