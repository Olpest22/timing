/** Палитры интерфейса. Список должен совпадать с client/src/lib/themes.ts и DESIGN.md. */
export const THEMES = ['graphite', 'day', 'ink'] as const;
export type Theme = (typeof THEMES)[number];
