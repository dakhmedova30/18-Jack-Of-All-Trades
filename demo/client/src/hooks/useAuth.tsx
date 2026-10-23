import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { Business } from '../types';

interface AuthContextValue {
  /** undefined while `loading`, or once checked, the logged-in business (or null if not logged in). */
  business: Business | null | undefined;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Loads the current session once on mount, then exposes it (and auth actions) to the whole app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Business | null | undefined>(undefined);

  useEffect(() => {
    authApi.getCurrentBusiness().then((found) => setBusiness(found ?? null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setBusiness(await authApi.login({ email, password }));
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setBusiness(await authApi.register({ name, email, password }));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ business, loading: business === undefined, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
