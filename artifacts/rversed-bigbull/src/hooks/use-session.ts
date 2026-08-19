// Session management for the RNS BIGBULL portal.
// Session tokens are persisted in localStorage and sent as
// Authorization: Bearer headers on every API request.
import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-base';

export interface SessionUser {
  id: number;
  email: string;
}

const SESSION_KEY = 'rb_session';

function storedToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function authHeaders(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function readStoredSessionToken(): string | null {
  return storedToken();
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = storedToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/session`, { headers: authHeaders(token) });
      const data = (await response.json()) as { user: SessionUser | null };
      if (response.ok && data.user) {
        setUser(data.user);
      } else {
        try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const token = storedToken();
    if (token) {
      try {
        await fetch(`${getApiBaseUrl()}/api/auth/logout`, { method: 'POST', headers: authHeaders(token) });
      } catch { /* noop — clear locally anyway */ }
    }
    try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
    setUser(null);
  }, []);

  return { user, loading, refresh, logout };
}
