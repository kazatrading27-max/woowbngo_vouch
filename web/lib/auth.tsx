'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, post } from './api';
import { clearSession, getToken, parseUser, saveSession } from './auth-helpers';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  bootstrap: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = parseUser<User>();
    if (getToken() && u) {
      setUser(u);
      api<User>('/auth/me')
        .then((fresh) => {
          setUser(fresh);
          saveSession(getToken()!, fresh);
        })
        .catch(() => {
          clearSession();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    saveSession(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const bootstrap = useCallback(async (email: string, password: string, name: string) => {
    const res = await post<{ accessToken: string; user: User }>('/auth/bootstrap', { email, password, name });
    saveSession(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await api<User>('/auth/me');
    setUser(fresh);
    saveSession(getToken()!, fresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin: user?.role === 'ADMIN', login, bootstrap, logout, refresh }),
    [user, loading, login, bootstrap, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
