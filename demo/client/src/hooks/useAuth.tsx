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
  /** Saves changes to the business's details; rejects with an ApiError if the server refuses. */
  updateBusiness: (update: authApi.BusinessUpdate) => Promise<void>;
  /** Sets the profile picture. */
  setAvatar: (image: Blob) => Promise<void>;
  /** Removes the profile picture, going back to initials. */
  removeAvatar: () => Promise<void>;
  /** Permanently deletes the account; on success the user is logged out. */
  deleteAccount: (currentPassword: string) => Promise<void>;
  /** Sets the business logo. */
  setLogo: (image: Blob) => Promise<void>;
  /** Removes the business logo. */
  removeLogo: () => Promise<void>;
  /** Changes the login email, confirmed with the current password. */
  changeEmail: (email: string, currentPassword: string) => Promise<void>;
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

  const updateBusiness = useCallback(async (update: authApi.BusinessUpdate) => {
    setBusiness(await authApi.updateBusiness(update));
  }, []);

  const setAvatar = useCallback(async (image: Blob) => {
    setBusiness(await authApi.uploadAvatar(image));
  }, []);

  const removeAvatar = useCallback(async () => {
    setBusiness(await authApi.deleteAvatar());
  }, []);

  const deleteAccount = useCallback(async (currentPassword: string) => {
    await authApi.deleteAccount(currentPassword);
    setBusiness(null); // RequireAuth then sends the user to /login
  }, []);

  const setLogo = useCallback(async (image: Blob) => {
    setBusiness(await authApi.uploadLogo(image));
  }, []);

  const removeLogo = useCallback(async () => {
    setBusiness(await authApi.deleteLogo());
  }, []);

  const changeEmail = useCallback(async (email: string, currentPassword: string) => {
    setBusiness(await authApi.changeEmail(email, currentPassword));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        business,
        loading: business === undefined,
        login,
        register,
        logout,
        updateBusiness,
        setAvatar,
        removeAvatar,
        setLogo,
        removeLogo,
        deleteAccount,
        changeEmail,
      }}
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
