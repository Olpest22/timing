/** Часовые пояса на клиенте: подписи и разница с поясом зрителя. */

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function partOf(tz: string, style: 'longGeneric' | 'shortOffset', at = new Date()) {
  return (
    new Intl.DateTimeFormat('ru-RU', { timeZone: tz, timeZoneName: style })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? tz
  );
}

/** «Москва (GMT+3)» */
export function tzLabel(tz: string, at = new Date()) {
  const name = partOf(tz, 'longGeneric', at).replace(/, стандартное время$/, '');
  const offset = partOf(tz, 'shortOffset', at);
  // У UTC и «Etc/GMT±N» нет названия города — только смещение
  return /^(GMT|UTC)/.test(name) ? offset : `${name} (${offset})`;
}

/** Смещение пояса от UTC в минутах в момент at */
export function tzOffsetMinutes(tz: string, at = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** На сколько минут время зрителя впереди пояса мероприятия (в день мероприятия) */
export function viewerShiftMinutes(eventTz: string, day: string, viewerTz = browserTimeZone()) {
  const at = new Date(`${day}T12:00:00Z`);
  return tzOffsetMinutes(viewerTz, at) - tzOffsetMinutes(eventTz, at);
}

/** Все пояса для выбора (если браузер умеет их перечислить) */
export function allTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return intl.supportedValuesOf?.('timeZone') ?? [browserTimeZone()];
}
