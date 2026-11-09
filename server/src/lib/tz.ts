/*
 * Часовые пояса. Сетка мероприятия ведётся в «настенном» времени пояса мероприятия
 * (event.timezone, IANA, например Europe/Moscow). Для календаря и сравнения с «сейчас»
 * настенное время переводится в UTC.
 */

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Смещение пояса tz от UTC в минутах в момент utcMs (учитывает летнее время) */
export function tzOffsetMinutes(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
}

/** Настенное время '2026-11-17T16:00' в поясе tz → момент UTC */
export function wallToUtc(wall: string, tz: string): Date {
  const guess = Date.parse(`${wall}:00Z`);
  // Два прохода: смещение могло поменяться между «догадкой» и ответом (переход на летнее время)
  let utc = guess - tzOffsetMinutes(guess, tz) * 60_000;
  utc = guess - tzOffsetMinutes(utc, tz) * 60_000;
  return new Date(utc);
}
