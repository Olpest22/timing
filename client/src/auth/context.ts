import { createContext, useContext } from 'react';
import type { RegisterInput, User } from './types';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  /** true, если пользователь сам нажал «Выйти» (а не просто не входил) */
  loggedOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  /** Вход по ссылке только с именем */
  loginAsGuest: (name: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен вызываться внутри <AuthProvider>');
  return ctx;
}
