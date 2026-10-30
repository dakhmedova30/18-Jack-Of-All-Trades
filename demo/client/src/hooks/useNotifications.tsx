import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listNotifications } from '../api/notifications';
import type { AppNotification } from '../types';
import { useAuth } from './useAuth';

const POLL_MS = 2 * 60 * 1000;

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
  /** Refetches now, e.g. after the settings change. */
  reload: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Fetches the alerts when the app opens and every couple of minutes, and remembers which ones
 * the user dismissed in this browser. Dismissing is per browser; the alerts themselves come from
 * the server.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth();
  const businessId = business?.id;
  const [all, setAll] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState(() => loadDismissed(businessId));
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = () => {
      listNotifications()
        .then((alerts) => {
          if (!cancelled) setAll(alerts);
        })
        .catch(() => {
          // The bell is a convenience: if this fails, keep what we had and try again later.
        });
    };
    fetchAlerts();
    const timer = setInterval(fetchAlerts, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reloadToken]);

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
      reload: () => setReloadToken((token) => token + 1),
    };
  }, [all, dismissed, saveDismissed]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
