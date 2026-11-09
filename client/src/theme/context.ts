import { createContext, useContext } from 'react';
import type { ThemeId } from '../lib/themes';

export type ThemeContextValue = { theme: ThemeId; setTheme: (id: ThemeId) => void };

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme должен вызываться внутри <ThemeProvider>');
  return ctx;
}
