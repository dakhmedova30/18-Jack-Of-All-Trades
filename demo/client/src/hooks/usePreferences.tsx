import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { formatDate as formatDateWith, type DateFormat } from '../utils/date';
import { useAuth } from './useAuth';

/** The server rejects page sizes over 100 (contract §1). */
export const MIN_ROWS_PER_PAGE = 1;
export const MAX_ROWS_PER_PAGE = 100;

export function isValidRowsPerPage(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_ROWS_PER_PAGE &&
    value <= MAX_ROWS_PER_PAGE
  );
}

/** Settings that live in this browser (per business), not on the server. */
export interface Preferences {
  dateFormat: DateFormat;
  rowsPerPage: number;
  /** Pre-selected in the Add sale form; null = nothing pre-selected. */
  defaultChannelId: number | null;
  /** Pre-selected in the Add expense form; null = nothing pre-selected. */
  defaultExpenseTag: string | null;
}

const DEFAULTS: Preferences = {
  dateFormat: 'medium',
  rowsPerPage: 15,
  defaultChannelId: null,
  defaultExpenseTag: null,
};

const DATE_FORMATS: DateFormat[] = ['medium', 'iso', 'dmy', 'mdy'];

function storageKey(businessId: number): string {
  return `jat:preferences:${businessId}`;
}

/** What was saved, with anything missing or invalid replaced by its default. Never throws. */
function load(businessId: number): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(businessId)) ?? '{}') as Partial<
      Record<keyof Preferences, unknown>
    >;
    return {
      dateFormat: DATE_FORMATS.includes(saved.dateFormat as DateFormat)
        ? (saved.dateFormat as DateFormat)
        : DEFAULTS.dateFormat,
      rowsPerPage: isValidRowsPerPage(saved.rowsPerPage) ? saved.rowsPerPage : DEFAULTS.rowsPerPage,
      defaultChannelId: typeof saved.defaultChannelId === 'number' ? saved.defaultChannelId : null,
      defaultExpenseTag:
        typeof saved.defaultExpenseTag === 'string' ? saved.defaultExpenseTag : null,
    };
  } catch {
    return DEFAULTS;
  }
}

interface PreferencesContextValue {
  preferences: Preferences;
  update: (changes: Partial<Preferences>) => void;
  /** Formats a date the way the user chose in Settings. */
  formatDate: (iso: string) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

/** Loads this business's saved preferences and keeps them in localStorage. Needs a logged-in user. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth();
  const businessId = business?.id;
  const [preferences, setPreferences] = useState<Preferences>(() =>
    businessId === undefined ? DEFAULTS : load(businessId),
  );

  const update = useCallback(
    (changes: Partial<Preferences>) => {
      setPreferences((current) => {
        const next = { ...current, ...changes };
        if (businessId !== undefined) {
          try {
            localStorage.setItem(storageKey(businessId), JSON.stringify(next));
          } catch {
            // Storage blocked or full: the setting still applies until the page is closed.
          }
        }
        return next;
      });
    },
    [businessId],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      update,
      formatDate: (iso: string) => formatDateWith(iso, preferences.dateFormat),
    }),
    [preferences, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
}
