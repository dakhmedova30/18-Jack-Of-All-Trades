import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onDataChanged } from '../api/http';
import { listNotifications } from '../api/notifications';
import type { AppNotification } from '../types';
import { useAuth } from './useAuth';

/** Catches changes made elsewhere (another tab or device); this tab's own saves refetch at once. */
export const POLL_MS = 30 * 1000;

/** Identifies an alert and its situation: a changed fingerprint is a new alert, not a dismissed one. */
export function notificationKey(alert: AppNotification): string {
  return `${alert.type}:${alert.fingerprint}`;
}

function storageKey(businessId: number): string {
  return `jat:dismissed-notifications:${businessId}`;
}

function loadDismissed(businessId: number | undefined): Set<string> {
  if (businessId === undefined) return new Set();
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(businessId)) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

interface NotificationsContextValue {
  /** The alerts that apply and haven't been dismissed. */
  alerts: AppNotification[];
  dismiss: (alert: AppNotification) => void;
  dismissAll: () => void;
  /** Brings dismissed alerts back (they hide again if dismissed again). */
  showDismissed: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Fetches the alerts when the app opens, right after any save (a sale can put an item below the
 * low-stock threshold), and every 30 seconds while the tab is visible. A hidden tab doesn't poll,
 * so a forgotten tab doesn't keep querying the database; it catches up when shown again.
 * Remembers which alerts the user dismissed in this browser; the alerts themselves come from the
 * server.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth();
  const businessId = business?.id;
  const [all, setAll] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState(() => loadDismissed(businessId));

  useEffect(() => {
    // Only the newest request may update the alerts, so a slow older response can't overwrite a
    // newer one. Bumping it on unmount drops any response still in flight.
    let latest = 0;
    const fetchAlerts = () => {
      const request = ++latest;
      listNotifications()
        .then((alerts) => {
          if (request === latest) setAll(alerts);
        })
        .catch(() => {
          // The bell is a convenience: if this fails, keep what we had and try again later.
        });
    };

    let timer: ReturnType<typeof setInterval> | undefined;
    const stopPolling = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const startPolling = () => {
      stopPolling();
      fetchAlerts();
      timer = setInterval(fetchAlerts, POLL_MS);
    };
    const onVisibilityChange = () => (document.hidden ? stopPolling() : startPolling());

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    const unsubscribe = onDataChanged(fetchAlerts);
    return () => {
      latest++;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribe();
    };
  }, []);

  const saveDismissed = useCallback(
    (next: Set<string>) => {
      setDismissed(next);
      if (businessId === undefined) return;
      try {
        localStorage.setItem(storageKey(businessId), JSON.stringify([...next]));
      } catch {
        // Storage blocked: the dismissal still holds until the page is closed.
      }
    },
    [businessId],
  );

  const value = useMemo<NotificationsContextValue>(() => {
    const keys = (alerts: AppNotification[]) => new Set(alerts.map(notificationKey));
    // Forget dismissals for alerts that have gone away, so one that comes back shows again.
    const prune = (set: Set<string>) => {
      const current = keys(all);
      return new Set([...set].filter((key) => current.has(key)));
    };
    return {
      alerts: all.filter((alert) => !dismissed.has(notificationKey(alert))),
      dismiss: (alert) => saveDismissed(prune(new Set([...dismissed, notificationKey(alert)]))),
      dismissAll: () => saveDismissed(keys(all)),
      showDismissed: () => saveDismissed(new Set()),
    };
  }, [all, dismissed, saveDismissed]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
