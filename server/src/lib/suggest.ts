/*
 * Подбор лучшего времени. Чистая функция без БД — её легко тестировать.
 *
 * Окно = DURATION / STEP подряд идущих клеток одного дня. Для каждого участника берём
 * минимальный уровень по окну: человек должен быть свободен всё время встречи, а не часть.
 *   свободен (2) → 1 балл, «если очень надо» (1) → 0.5, занят → 0.
 * Окна, где занят хоть один обязательный участник, отбрасываются.
 * Сортировка: больше баллов → раньше по времени. Возвращаем непересекающиеся окна.
 */

export type Level = 1 | 2;

export type SuggestInput = {
  days: string[]; // ['2026-11-16', …]
  rows: number[]; // начала клеток дня в минутах: [600, 630, …]
  stepMin: number;
  durationMin: number;
  participants: { id: number; required: boolean }[];
  /** 'YYYY-MM-DDTHH:MM' → (id участника → уровень) */
  availability: Map<string, Map<number, Level>>;
  limit?: number;
};

export type Suggestion = {
  start: string; // 'YYYY-MM-DDTHH:MM'
  end: string;
  score: number;
  free: number[];
  maybe: number[];
  busy: number[];
};

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const slotKey = (day: string, min: number) => `${day}T${hhmm(min)}`;

export function suggest(input: SuggestInput): Suggestion[] {
  const { days, rows, stepMin, durationMin, participants, availability, limit = 3 } = input;
  const length = durationMin / stepMin;
  if (!Number.isInteger(length) || length < 1 || length > rows.length || participants.length === 0)
    return [];

  type Candidate = Suggestion & { day: number; from: number; to: number };
  const candidates: Candidate[] = [];

  days.forEach((day, d) => {
    for (let i = 0; i + length <= rows.length; i++) {
      const keys = rows.slice(i, i + length).map((m) => slotKey(day, m));
      const free: number[] = [];
      const maybe: number[] = [];
      const busy: number[] = [];
      let requiredBusy = false;

      for (const p of participants) {
        // минимальный уровень участника по всему окну
        let level = 2;
        for (const k of keys) {
          level = Math.min(level, availability.get(k)?.get(p.id) ?? 0);
          if (level === 0) break;
        }
        if (level === 2) free.push(p.id);
        else if (level === 1) maybe.push(p.id);
        else {
          busy.push(p.id);
          if (p.required) requiredBusy = true;
        }
      }

      const score = free.length + maybe.length / 2;
      if (requiredBusy || score === 0) continue;
      candidates.push({
        day: d,
        from: i,
        to: i + length,
        start: keys[0],
        end: slotKey(day, rows[i] + durationMin),
        score,
        free,
        maybe,
        busy,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score || a.day - b.day || a.from - b.from);

  // Жадно берём лучшие окна, пропуская пересекающиеся с уже выбранными
  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.some((p) => p.day === c.day && c.from < p.to && p.from < c.to)) continue;
    picked.push(c);
    if (picked.length === limit) break;
  }
  return picked.map(({ start, end, score, free, maybe, busy }) => ({
    start,
    end,
    score,
    free,
    maybe,
    busy,
  }));
}
