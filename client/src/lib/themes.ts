/** Палитры интерфейса. Список должен совпадать с server/src/lib/themes.ts и DESIGN.md. */
export const THEMES = [
  {
    id: 'graphite',
    name: 'Графит',
    tone: 'тёмная',
    canvas: 'oklch(0.27 0.01 255)',
    ink: 'oklch(0.47 0.13 158)',
  },
  {
    id: 'day',
    name: 'День',
    tone: 'светлая',
    canvas: 'oklch(0.9 0.008 250)',
    ink: 'oklch(0.45 0.17 262)',
  },
  {
    id: 'ink',
    name: 'Чернила',
    tone: 'тёмная',
    canvas: 'oklch(0.28 0.006 280)',
    ink: 'oklch(0.47 0.21 295)',
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const DEFAULT_THEME: ThemeId = 'graphite';

const KEY = 'timing.theme';

export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* приватный режим — палитра просто не запомнится в этом браузере */
  }
}

/** Применяет палитру к <html>: «Графит» — значения по умолчанию, без атрибута. */
export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.dataset.theme = id;
}
