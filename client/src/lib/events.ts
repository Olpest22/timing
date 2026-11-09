import { api } from './api';

export type EventParticipant = {
  id: number;
  name: string;
  isOrganizer: boolean;
  isRequired: boolean;
  responded: boolean;
};

export type TimingEvent = {
  code: string;
  title: string;
  description: string | null;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  dayStart: string; // HH:MM
  dayEnd: string;
  durationMin: number;
  slotStepMin: 15 | 30 | 60;
  status: 'open' | 'closed';
  finalStart: string | null;
  organizer: { id: number; name: string };
  participantCount: number;
  respondedCount: number;
  me: { isOrganizer: boolean; responded: boolean } | null;
  /** Только для участников */
  participants: EventParticipant[] | null;
};

export type NewEventInput = {
  title: string;
  description?: string;
  dateFrom: string;
  dateTo: string;
  dayStart: string;
  dayEnd: string;
  durationMin: number;
  slotStepMin: 15 | 30 | 60;
};

export const eventsApi = {
  list: () => api<{ events: TimingEvent[] }>('/events').then((r) => r.events),
  get: (code: string) =>
    api<{ event: TimingEvent }>(`/events/${encodeURIComponent(code)}`).then((r) => r.event),
  create: (input: NewEventInput) =>
    api<{ event: TimingEvent }>('/events', { method: 'POST', body: JSON.stringify(input) }).then(
      (r) => r.event,
    ),
  join: (code: string) =>
    api<{ event: TimingEvent }>(`/events/${encodeURIComponent(code)}/join`, {
      method: 'POST',
    }).then((r) => r.event),
};

// ── Форматирование ────────────────────────────────────────────────────────────────

const dayMonth = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const utc = (d: string) => new Date(`${d}T00:00:00Z`);

/** 16–20 ноября · 30 ноября – 4 декабря · 16 ноября */
export function formatDateRange(from: string, to: string) {
  if (from === to) return dayMonth.format(utc(from));
  const a = utc(from);
  const b = utc(to);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${dayMonth.format(b)}`;
  return `${dayMonth.format(a)} – ${dayMonth.format(b)}`;
}

/** 30 мин · 2 ч · 1 ч 30 мин */
export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

/** plural(3, ['день', 'дня', 'дней']) → 'дня' */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Дней в диапазоне включительно */
export const daysBetween = (from: string, to: string) =>
  Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000) + 1;

/** Ссылка-приглашение */
export const inviteUrl = (code: string) => `${window.location.origin}/e/${code}`;

/** Куда разложить мероприятие в кабинете */
export function bucketOf(e: TimingEvent, now = new Date()): 'waiting' | 'scheduled' | 'past' {
  const todayStr = now.toISOString().slice(0, 10);
  if (e.status === 'closed' && e.finalStart)
    return new Date(e.finalStart) >= now ? 'scheduled' : 'past';
  if (e.dateTo < todayStr) return 'past';
  return 'waiting';
}

// ── Доступность ───────────────────────────────────────────────────────────────────

export type Slot = { start: string; level: 1 | 2 };

export const availabilityApi = {
  mine: (code: string) =>
    api<{ slots: Slot[] }>(`/events/${encodeURIComponent(code)}/availability`).then((r) => r.slots),
  save: (code: string, starts: string[]) =>
    api<{ saved: number }>(`/events/${encodeURIComponent(code)}/availability`, {
      method: 'PUT',
      body: JSON.stringify({ slots: starts.map((start) => ({ start, level: 2 })) }),
    }),
};

/** Дни мероприятия: ['2026-11-16', '2026-11-17', …] */
export function eventDays(e: Pick<TimingEvent, 'dateFrom' | 'dateTo'>) {
  const n = daysBetween(e.dateFrom, e.dateTo);
  return Array.from({ length: n }, (_, i) => {
    const d = utc(e.dateFrom);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Начала клеток дня в минутах: [600, 630, …] */
export function eventRows(e: Pick<TimingEvent, 'dayStart' | 'dayEnd' | 'slotStepMin'>) {
  const from = minutesOf(e.dayStart);
  const to = minutesOf(e.dayEnd);
  return Array.from({ length: (to - from) / e.slotStepMin }, (_, i) => from + i * e.slotStepMin);
}

/** Ключ клетки = её начало: 2026-11-16T10:30 */
export const slotKey = (day: string, min: number) => `${day}T${hhmm(min)}`;

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const dayShort = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** «Пн» */
export const formatWeekday = (d: string) => {
  const w = weekday.format(utc(d));
  return w.charAt(0).toUpperCase() + w.slice(1);
};
/** «16 нояб.» */
export const formatDayShort = (d: string) => dayShort.format(utc(d));
/** «понедельник, 16 ноября» */
export const formatDayLong = (d: string) => weekdayLong.format(utc(d));
