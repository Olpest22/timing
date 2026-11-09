import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, tokenStorage } from '../lib/api';
import { readStoredTheme } from '../lib/themes';
import { AuthContext, type AuthContextValue } from './context';
import type { AuthResponse, RegisterInput, User } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [loading, setLoading] = useState(() => tokenStorage.get() !== null);

  // При загрузке страницы восстанавливаем пользователя по сохранённому токену
  useEffect(() => {
    if (!tokenStorage.get()) return;
    api<{ user: User }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) tokenStorage.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback(({ token, user }: AuthResponse) => {
    tokenStorage.set(token);
    setLoggedOut(false);
    setUser(user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      handleAuth(
        await api<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      );
    },
    [handleAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      handleAuth(
        await api<AuthResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ ...input, timezone, theme: readStoredTheme() }),
        }),
      );
    },
    [handleAuth],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setLoggedOut(true);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, loggedOut, login, register, logout }),
    [user, loading, loggedOut, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
