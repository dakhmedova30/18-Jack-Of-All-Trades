import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { listLoginActivity, listSessions } from '../api/security';
import type { LoginEvent, SessionInfo } from '../types';

/**
 * The devices logged in and the recent logins, for the Security tab. Call `reload()` after
 * something changes them (e.g. logging out other devices).
 */
export function useSecurityInfo() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    sessions?: SessionInfo[];
    logins?: LoginEvent[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSessions(), listLoginActivity()])
      .then(([sessions, logins]) => {
        if (!cancelled) setResult({ token: reloadToken, sessions, logins });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: reloadToken, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    sessions: result?.sessions,
    logins: result?.logins,
    error: result?.error,
    loading: result?.token !== reloadToken,
    reload,
  };
}
