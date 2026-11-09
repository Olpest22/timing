/*
 * Время дня хранится в колонках TIME, Prisma отдаёт его как Date 1970-01-01Thh:mm:00Z.
 * Даты мероприятия — колонки DATE (полночь UTC). Пока все времена — «настенные», без
 * часовых поясов; пересчёт по поясам — этап 6.
 */

/** "09:30" → Date для колонки TIME */
export const timeToDate = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

/** Date из колонки TIME → "09:30" */
export const dateToTime = (d: Date) => d.toISOString().slice(11, 16);

/** "2026-11-16" → Date для колонки DATE */
export const dayToDate = (yyyymmdd: string) => new Date(`${yyyymmdd}T00:00:00Z`);

/** Date из колонки DATE → "2026-11-16" */
export const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Сегодня в формате YYYY-MM-DD (по часам сервера). */
export const today = () => new Date().toISOString().slice(0, 10);
