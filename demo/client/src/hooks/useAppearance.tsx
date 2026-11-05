import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type TextSize = 'small' | 'default' | 'large';
export type Accent = 'maroon' | 'blue' | 'green' | 'purple' | 'teal';

export interface Appearance {
  theme: ThemeChoice;
  density: Density;
  textSize: TextSize;
  accent: Accent;
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'light',
  density: 'comfortable',
  textSize: 'default',
  accent: 'maroon',
};

export const THEMES: ThemeChoice[] = ['light', 'dark', 'system'];
export const DENSITIES: Density[] = ['compact', 'comfortable', 'spacious'];
export const TEXT_SIZES: TextSize[] = ['small', 'default', 'large'];
export const ACCENTS: Accent[] = ['maroon', 'blue', 'green', 'purple', 'teal'];

/** Shared with the inline script in index.html, which applies these before React loads. */
const STORAGE_KEY = 'jat:appearance';

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** What was saved, with anything missing or invalid replaced by its default. Never throws. */
function load(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      theme: pick(saved.theme, THEMES, DEFAULT_APPEARANCE.theme),
      density: pick(saved.density, DENSITIES, DEFAULT_APPEARANCE.density),
      textSize: pick(saved.textSize, TEXT_SIZES, DEFAULT_APPEARANCE.textSize),
      accent: pick(saved.accent, ACCENTS, DEFAULT_APPEARANCE.accent),
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface AppearanceContextValue {
  appearance: Appearance;
  update: (changes: Partial<Appearance>) => void;
  reset: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

/**
 * The look of the app: theme, accent colour, text size and table density. Kept in this browser
 * (not per account, so the login page matches too) and applied as data attributes on <html>,
 * which styles.css turns into colours and sizes.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(load);
  // Only matters while the theme is "system": follows the device if it flips light/dark.
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const dark = appearance.theme === 'dark' || (appearance.theme === 'system' && systemDark);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.density = appearance.density;
    root.dataset.textSize = appearance.textSize;
    root.dataset.accent = appearance.accent;
  }, [appearance, systemDark]);

  const save = useCallback((next: Appearance) => {
    setAppearance(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked or full: the choice still applies until the page is closed.
    }
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      appearance,
      update: (changes) => save({ ...appearance, ...changes }),
      reset: () => save(DEFAULT_APPEARANCE),
    }),
    [appearance, save],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within an AppearanceProvider');
  return context;
}
