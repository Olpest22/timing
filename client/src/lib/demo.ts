/*
 * Образец для демо на главной (data-sample): команда из шести человек и их свободные часы
 * на неделю. Посетитель — седьмой участник «вы». Та же модель, что будет у настоящих
 * мероприятий на этапах 3–5: клетка = час, лучший слот = окно, где свободно больше всего людей.
 */

export const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
export const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'];
export const FIRST_HOUR = 10;
export const HOURS = Array.from({ length: 10 }, (_, i) => FIRST_HOUR + i); // 10:00 … 19:00
export const DURATION = 2; // часа

export const YOU = 'вы';

type Range = [from: number, to: number]; // [10, 13) — свободен с 10:00 до 13:00
export const TEAM: { name: string; days: Range[] }[] = [
  { name: 'Аня', days: [[10, 13], [14, 20], [10, 12], [15, 20], [10, 14]] },
  { name: 'Петя', days: [[16, 20], [10, 12], [13, 18], [16, 20], [15, 18]] },
  { name: 'Олег', days: [[10, 12], [15, 19], [10, 15], [10, 13], [12, 17]] },
  { name: 'Маша', days: [[13, 18], [16, 20], [17, 20], [14, 20], [10, 12]] },
  { name: 'Дима', days: [[11, 15], [10, 13], [15, 20], [17, 20], [13, 19]] },
  { name: 'Лена', days: [[17, 20], [12, 17], [10, 13], [16, 19], [16, 20]] },
];
export const TOTAL = TEAM.length + 1;

export const cellKey = (day: number, hour: number) => `${day}-${hour}`;
export const time = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Свободен ли участник (или «вы») в этот час. */
export function isFree(name: string, day: number, hour: number, mine: Set<string>) {
  if (name === YOU) return mine.has(cellKey(day, hour));
  const range = TEAM.find((m) => m.name === name)!.days[day];
  return hour >= range[0] && hour < range[1];
}

export function freeCount(day: number, hour: number, mine: Set<string>) {
  return [...TEAM.map((m) => m.name), YOU].filter((n) => isFree(n, day, hour, mine)).length;
}

export type Best = { day: number; hour: number; count: number; missing: string[] };

/** Окно длиной DURATION, где весь интервал свободно больше всего людей; при равенстве — раньше. */
export function findBest(mine: Set<string>): Best {
  const everyone = [...TEAM.map((m) => m.name), YOU];
  let best: Best = { day: 0, hour: FIRST_HOUR, count: -1, missing: [] };
  for (let day = 0; day < DAYS.length; day++) {
    for (const hour of HOURS.slice(0, HOURS.length - DURATION + 1)) {
      const hours = Array.from({ length: DURATION }, (_, i) => hour + i);
      const free = everyone.filter((name) => hours.every((h) => isFree(name, day, h, mine)));
      if (free.length > best.count) {
        best = { day, hour, count: free.length, missing: everyone.filter((n) => !free.includes(n)) };
      }
    }
  }
  return best;
}

export function listNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

export const HEAT_BG = [
  'bg-heat-0',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
  'bg-heat-5',
  'bg-heat-6',
  'bg-heat-7',
];
