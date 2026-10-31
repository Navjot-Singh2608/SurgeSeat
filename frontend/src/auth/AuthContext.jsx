import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setSessionExpiredHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  // On first load, try to restore the session from the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    api.restoreSession()
      .then((u) => !cancelled && (setUser(u), setStatus('authenticated')))
      .catch(() => !cancelled && setStatus('anonymous'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (credentials) => {
    await api.login(credentials);
    const me = await api.me();
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, isAdmin: user?.role === 'ADMIN', login, logout, register: api.register }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
