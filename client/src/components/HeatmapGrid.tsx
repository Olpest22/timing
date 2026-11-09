import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  HEAT_BG,
  ROW_H,
  eventDays,
  eventRows,
  formatDayLong,
  formatDayShort,
  formatWeekday,
  heatLevel,
  hhmm,
  listNames,
  slotKey,
  type EventParticipant,
  type Heatmap,
  type TimingEvent,
} from '../lib/events';

type Props = {
  event: TimingEvent;
  heat: Heatmap;
  participants: EventParticipant[];
  /** id участника, чьё время показать вместо общей карты */
  spotlight: number | null;
};

type Cell = { d: number; r: number };

/**
 * Общая карта: ленты дней, плотность чернил — сколько людей свободно. Наведение или
 * фокус показывают, кто может и кто нет. Режим «один человек» — только его время.
 */
export function HeatmapGrid({ event, heat, participants, spotlight }: Props) {
  const days = useMemo(() => eventDays(event), [event]);
  const rows = useMemo(() => eventRows(event), [event]);
  const rowH = ROW_H[event.slotStepMin];
  const perHour = 60 / event.slotStepMin;
  const names = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants]);
  const person = spotlight != null ? participants.find((p) => p.id === spotlight) : undefined;
  const [focus, setFocus] = useState<Cell>({ d: 0, r: 0 });
  const [tip, setTip] = useState<Cell | null>(null);

  const freeAt = (c: Cell) => heat.free.get(slotKey(days[c.d], rows[c.r])) ?? [];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const c = {
      d: Math.min(days.length - 1, Math.max(0, focus.d + m[0])),
      r: Math.min(rows.length - 1, Math.max(0, focus.r + m[1])),
    };
    setFocus(c);
    e.currentTarget
      .querySelector<HTMLElement>(`[data-cell="${slotKey(days[c.d], rows[c.r])}"]`)
      ?.focus();
  }

  function describe(c: Cell) {
    const free = freeAt(c);
    const time = `${formatDayLong(days[c.d])}, ${hhmm(rows[c.r])}–${hhmm(rows[c.r] + event.slotStepMin)}`;
    if (person) return `${time}: ${person.name} ${free.includes(person.id) ? 'может' : 'не может'}`;
    return `${time}: свободны ${free.length} из ${heat.total}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {heat.responded === 0 && (
        <p className="rounded-control bg-card-sunk px-4 py-3 text-small">
          Пока никто не отметил время. Карта заполнится, когда участники отметятся.
        </p>
      )}

      <div className="scroll-fade -mx-4 overflow-x-auto px-4 pt-2 pb-4 sm:-mx-8 sm:px-8">
        <div
          role="grid"
          aria-label={person ? `Время участника ${person.name}` : 'Когда свободна команда'}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setTip(null)}
          className="relative grid w-max min-w-full select-none gap-x-1.5"
          style={{
            gridTemplateColumns: `3rem repeat(${days.length}, minmax(3.25rem, 1fr))`,
            gridTemplateRows: `auto repeat(${rows.length}, ${rowH}px)`,
          }}
        >
          <div role="row" className="contents">
            <span role="columnheader" aria-label="Время" className="sticky left-0 z-20 bg-card" />
            {days.map((day) => (
              <span
                key={day}
                role="columnheader"
                aria-label={formatDayLong(day)}
                className="flex flex-col items-center pb-2 leading-tight"
              >
                <span className="text-small font-bold">{formatWeekday(day)}</span>
                <span className="text-caption text-ink-muted">{formatDayShort(day)}</span>
              </span>
            ))}
          </div>

          {rows.map((min, r) => (
            <div role="row" key={min} className="contents">
              <span
                role="rowheader"
                aria-label={hhmm(min)}
                className="sticky left-0 z-20 bg-card font-mono text-caption tabular text-ink-muted"
              >
                {r % perHour === 0 && <span className="block -translate-y-1/2">{hhmm(min)}</span>}
              </span>
              {days.map((day, d) => {
                const c = { d, r };
                const free = freeAt(c);
                const bg = person
                  ? free.includes(person.id)
                    ? 'bg-signal'
                    : 'bg-heat-0'
                  : HEAT_BG[heatLevel(free.length, heat.total)];
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    data-cell={slotKey(day, min)}
                    tabIndex={focus.d === d && focus.r === r ? 0 : -1}
                    aria-label={describe(c)}
                    onFocus={() => {
                      setFocus(c);
                      setTip(c);
                    }}
                    onBlur={() => setTip(null)}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setTip(c)}
                    onClick={() => setTip(c)}
                    className={`ui-focus relative ${bg} ${r === 0 ? 'rounded-t-cell' : ''} ${
                      r === rows.length - 1 ? 'rounded-b-cell' : ''
                    } ${r > 0 && r % perHour === 0 ? 'border-t border-card/50' : ''}`}
                  />
                );
              })}
            </div>
          ))}

          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 z-30 translate-y-1/2 font-mono text-caption tabular text-ink-muted"
            style={{ gridColumn: 1, gridRow: `${rows.length + 1}` }}
          >
            {event.dayEnd}
          </span>

          {tip && renderTip(tip)}
        </div>
      </div>

      <Legend total={heat.total} person={person?.name} />
    </div>
  );

  function renderTip(cell: Cell) {
    const free = freeAt(cell);
    const busy = participants.filter((p) => !free.includes(p.id)).map((p) => p.name);
    const freeNames = free.map((id) => names.get(id) ?? '—');
    const short = (list: string[]) =>
      list.length > 5 ? `${list.slice(0, 5).join(', ')} и ещё ${list.length - 5}` : listNames(list);
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 z-40 flex ${cell.r < 3 ? 'top-full mt-1' : 'bottom-full mb-1'} w-max max-w-64 -translate-x-1/2 flex-col gap-0.5 rounded-control bg-ink px-3 py-2 text-caption text-on-signal`}
        style={{ gridColumn: `${cell.d + 2} / span 1`, gridRow: `${cell.r + 2} / span 1` }}
      >
        <span>
          {formatWeekday(days[cell.d])}, {hhmm(rows[cell.r])}–
          {hhmm(rows[cell.r] + event.slotStepMin)}
        </span>
        {person ? (
          <b className="text-small">
            {person.name} {free.includes(person.id) ? 'может' : 'не может'}
          </b>
        ) : (
          <>
            <b className="text-small">
              свободны {free.length} из {heat.total}
            </b>
            {freeNames.length > 0 && <span>может: {short(freeNames)}</span>}
            {busy.length > 0 && <span className="opacity-80">не могут: {short(busy)}</span>}
          </>
        )}
      </div>
    );
  }
}

function Legend({ total, person }: { total: number; person?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-ink-muted">
      {person ? (
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-6 rounded-cell bg-signal" />
          {person} может
        </span>
      ) : (
        <span className="flex items-center gap-2 whitespace-nowrap">
          никого
          <span className="flex" aria-hidden>
            {HEAT_BG.map((bg, i) => (
              <span
                key={bg}
                className={`h-3 w-3 ${bg} ${i === 0 ? 'rounded-l-cell' : ''} ${i === 7 ? 'rounded-r-cell' : ''}`}
              />
            ))}
          </span>
          все {total}
        </span>
      )}
      <span>
        {person
          ? 'Нажмите на участника ещё раз, чтобы вернуть общую карту.'
          : 'Нажмите на участника, чтобы увидеть только его время.'}
      </span>
    </div>
  );
}
