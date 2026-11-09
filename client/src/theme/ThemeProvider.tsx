import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/context';
import { api } from '../lib/api';
import { applyTheme, isTheme, readStoredTheme, storeTheme, type ThemeId } from '../lib/themes';
import { ThemeContext } from './context';

/**
 * Палитра: у гостя хранится в браузере, у вошедшего — в профиле на сервере (переезжает
 * между устройствами). При входе побеждает палитра из профиля.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);
  const [syncedUserId, setSyncedUserId] = useState<number | null>(null);

  // Вошёл другой пользователь — берём его палитру из профиля. Подстройка состояния
  // во время рендера (а не в эффекте), как рекомендует React.
  const userId = user?.id ?? null;
  if (userId !== syncedUserId) {
    setSyncedUserId(userId);
    if (user && isTheme(user.theme)) setThemeState(user.theme);
  }

  // Синхронизация с внешним миром: атрибут на <html> и localStorage
  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  const setTheme = useCallback(
    (id: ThemeId) => {
      setThemeState(id);
      if (user) {
        // Ошибка сохранения не отменяет выбор: палитра останется в этом браузере
        api('/auth/me', { method: 'PATCH', body: JSON.stringify({ theme: id }) }).catch(() => {});
      }
    },
    [user],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
