import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  eventDays,
  eventRows,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatWeekday,
  hhmm,
  ROW_H,
  slotKey,
  type Level,
  type TimingEvent,
} from '../lib/events';
import type { SaveState } from '../lib/useAvailability';

type Marks = Map<string, Level>;

type Props = {
  event: TimingEvent;
  selected: Marks;
  setSelection: (next: Marks) => void;
  saveState: SaveState;
  saveError: string | null;
  onRetry: () => void;
  /** Бледная подсказка: сколько других участников свободно в клетке */
  hint?: { count: (start: string) => number; total: number } | null;
};

type Cell = { d: number; r: number };
/** Отрезок: день, строки [r0, r1) и уровень */
type Seg = { d: number; r0: number; r1: number; level: Level };

const LEVEL_NAME: Record<Level, string> = { 2: 'Свободен', 1: 'Если очень надо' };

/**
 * Ленты дней. Под лентами — невидимые клетки (мышь, касание, клавиатура, скринридер),
 * поверх — слитые отрезки. Кисть задаёт уровень: «свободен» (сплошной отрезок) или
 * «если очень надо» (пунктирный). Мышь: протянуть прямоугольник, тянуть ручки, крестик.
 * Касание: начало и конец двумя нажатиями, касание отрезка — ручки и крестик.
 */
export function AvailabilityGrid({
  event,
  selected,
  setSelection,
  saveState,
  saveError,
  onRetry,
  hint,
}: Props) {
  const days = useMemo(() => eventDays(event), [event]);
  const rows = useMemo(() => eventRows(event), [event]);
  const rowH = ROW_H[event.slotStepMin];
  const perHour = 60 / event.slotStepMin;
  const key = (c: Cell) => slotKey(days[c.d], rows[c.r]);

  const [brush, setBrush] = useState<Level>(2);
  const [focus, setFocus] = useState<Cell>({ d: 0, r: 0 });
  const [hover, setHover] = useState<Cell | null>(null);
  const [painting, setPainting] = useState(false);
  const [anchor, setAnchor] = useState<Cell | null>(null); // касание: начало отрезка
  const [activeSeg, setActiveSeg] = useState<Seg | null>(null); // касание: выбранный отрезок
  const [undo, setUndo] = useState<Marks | null>(null);
  const paint = useRef<{ from: Cell; on: boolean; base: Marks } | null>(null);
  const resize = useRef<{ seg: Seg; edge: 'top' | 'bottom'; base: Marks } | null>(null);
  const lastPointer = useRef('mouse');
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const segments = useMemo(() => {
    const out: Seg[] = [];
    days.forEach((day, d) => {
      let cur: Seg | null = null;
      rows.forEach((min, r) => {
        const level = selected.get(slotKey(day, min));
        if (cur && level !== cur.level) {
          out.push({ ...cur, r1: r });
          cur = null;
        }
        if (level && !cur) cur = { d, r0: r, r1: r + 1, level };
      });
      if (cur) out.push({ ...(cur as Seg), r1: rows.length });
    });
    return out;
  }, [days, rows, selected]);

  const segAt = (c: Cell) => segments.find((s) => s.d === c.d && c.r >= s.r0 && c.r < s.r1) ?? null;

  // Мышь отпущена где угодно — протягивание и ручки заканчиваются
  useEffect(() => {
    const stop = () => {
      paint.current = null;
      resize.current = null;
      setPainting(false);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  // Затухание у края, за которым есть ещё дни
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [days.length]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  /** Прямоугольник от a до b: поставить уровень level или снять поверх base */
  function applyRect(base: Marks, a: Cell, b: Cell, on: boolean, level: Level = brush) {
    const next = new Map(base);
    for (let d = Math.min(a.d, b.d); d <= Math.max(a.d, b.d); d++)
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
        const k = key({ d, r });
        if (on) next.set(k, level);
        else next.delete(k);
      }
    setSelection(next);
  }

  function removeSeg(seg: Seg) {
    applyRect(selected, { d: seg.d, r: seg.r0 }, { d: seg.d, r: seg.r1 - 1 }, false);
    setActiveSeg(null);
  }

  /** Строка под указателем в ленте дня d (для ручек) */
  function rowAtY(d: number, clientY: number) {
    const first = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${key({ d, r: 0 })}"]`);
    if (!first) return 0;
    const top = first.getBoundingClientRect().top;
    return Math.min(rows.length - 1, Math.max(0, Math.floor((clientY - top) / rowH)));
  }

  function startResize(e: PointerEvent, seg: Seg, edge: 'top' | 'bottom') {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = new Map(selected);
    for (let r = seg.r0; r < seg.r1; r++) base.delete(key({ d: seg.d, r }));
    resize.current = { seg, edge, base };
  }

  function moveResize(e: PointerEvent) {
    const rs = resize.current;
    if (!rs) return;
    const r = rowAtY(rs.seg.d, e.clientY);
    const r0 = rs.edge === 'top' ? Math.min(r, rs.seg.r1 - 1) : rs.seg.r0;
    const r1 = rs.edge === 'bottom' ? Math.max(r + 1, rs.seg.r0 + 1) : rs.seg.r1;
    applyRect(rs.base, { d: rs.seg.d, r: r0 }, { d: rs.seg.d, r: r1 - 1 }, true, rs.seg.level);
    if (activeSeg) setActiveSeg({ ...rs.seg, r0, r1 });
  }

  function moveFocus(d: number, r: number) {
    const c = {
      d: Math.min(days.length - 1, Math.max(0, d)),
      r: Math.min(rows.length - 1, Math.max(0, r)),
    };
    setFocus(c);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${key(c)}"]`)?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveFocus(focus.d + moves[e.key][0], focus.r + moves[e.key][1]);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const seg = segAt(focus);
      if (seg) {
        e.preventDefault();
        removeSeg(seg);
      }
    } else if (e.key === 'Escape') {
      setAnchor(null);
      setActiveSeg(null);
    }
  }

  /** Касание: начало → конец; касание отрезка — показать ручки и крестик */
  function onTap(c: Cell) {
    const seg = segAt(c);
    if (seg && !anchor) {
      setActiveSeg(seg);
      return;
    }
    setActiveSeg(null);
    if (anchor && anchor.d === c.d) {
      applyRect(selected, anchor, c, true);
      setAnchor(null);
    } else {
      setAnchor(c);
    }
  }

  function toggleDay(d: number) {
    const all = rows.every((_, r) => selected.get(key({ d, r })) === brush);
    applyRect(selected, { d, r: 0 }, { d, r: rows.length - 1 }, !all);
  }

  function clearAll() {
    setUndo(new Map(selected));
    setSelection(new Map());
    setActiveSeg(null);
  }

  const shown = activeSeg ?? (hover && !painting ? segAt(hover) : null);
  const minutes = (level: Level) =>
    [...selected.values()].filter((l) => l === level).length * event.slotStepMin;
  const area = (d: number, r0: number, r1: number) => ({
    gridColumn: `${d + 2} / span 1`,
    gridRow: `${r0 + 2} / ${r1 + 2}`,
  });
  const end = (s: Seg) => hhmm(rows[s.r0] + (s.r1 - s.r0) * event.slotStepMin);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div
          role="radiogroup"
          aria-label="Чем отмечать"
          className="flex rounded-control bg-card-sunk p-1"
        >
          {([2, 1] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={brush === l}
              onClick={() => setBrush(l)}
              className={`ui-press ui-focus flex h-9 items-center gap-2 rounded-cell px-3 text-small font-bold ${
                brush === l ? 'bg-card text-ink' : 'text-ink-muted'
              }`}
            >
              <span
                aria-hidden
                className={`size-3 rounded-cell ${l === 2 ? 'bg-signal' : 'border-2 border-dashed border-signal'}`}
              />
              {LEVEL_NAME[l]}
            </button>
          ))}
        </div>
        <SaveStatus state={saveState} error={saveError} onRetry={onRetry} />
      </div>

      <div className="flex min-h-6 flex-wrap items-center gap-x-4 gap-y-2 text-small">
        {undo ? (
          <p className="flex items-center gap-2">
            Отметки очищены.
            <button
              type="button"
              onClick={() => {
                setSelection(undo);
                setUndo(null);
              }}
              className="ui-dim ui-focus rounded-control font-bold underline underline-offset-4"
            >
              Вернуть
            </button>
          </p>
        ) : selected.size > 0 ? (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Вы свободны: <b className="font-mono tabular">{formatDuration(minutes(2) || 0)}</b>
              {minutes(1) > 0 && (
                <>
                  , если очень надо:{' '}
                  <b className="font-mono tabular">{formatDuration(minutes(1))}</b>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="ui-dim ui-focus rounded-control text-ink-muted underline underline-offset-4"
            >
              Очистить
            </button>
          </p>
        ) : (
          <p>Отметьте, когда вы свободны: проведите по лентам или нажмите начало и конец.</p>
        )}
      </div>

      {anchor && (
        <div
          className="flex items-center justify-between gap-4 rounded-control bg-ink px-4 py-2 text-small text-on-signal"
          role="status"
        >
          <span>
            Начало:{' '}
            <b>
              {formatWeekday(days[anchor.d])} {hhmm(rows[anchor.r])}
            </b>
            . Нажмите, где отрезок заканчивается.
          </span>
          <button
            type="button"
            onClick={() => setAnchor(null)}
            className="ui-dim ui-focus rounded-control font-bold underline underline-offset-4"
          >
            Отмена
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="scroll-fade -mx-4 overflow-x-auto px-4 pt-2 pb-4 sm:-mx-8 sm:px-8"
        data-fade-left={edges.left || undefined}
        data-fade-right={edges.right || undefined}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label="Ваше свободное время. Пробел отмечает клетку, Delete удаляет отрезок"
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHover(null)}
          onPointerMove={moveResize}
          className="relative grid w-max min-w-full select-none gap-x-1.5"
          style={{
            gridTemplateColumns: `3rem repeat(${days.length}, minmax(3.25rem, 1fr))`,
            gridTemplateRows: `auto repeat(${rows.length}, ${rowH}px)`,
          }}
        >
          {/* Ленты дней: бумага с линейкой часов */}
          {days.map((day, d) => (
            <div
              key={`lane-${day}`}
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-cell ${d % 2 ? 'bg-card-sunk/60' : 'bg-card'}`}
              style={{
                ...area(d, 0, rows.length),
                backgroundImage:
                  'linear-gradient(var(--color-rule) 1px, transparent 1px), linear-gradient(color-mix(in oklab, var(--color-rule) 45%, transparent) 1px, transparent 1px)',
                backgroundSize: `100% ${rowH * perHour}px, 100% ${rowH}px`,
              }}
            />
          ))}

          <div role="row" className="contents">
            <span role="columnheader" aria-label="Время" className="sticky left-0 z-20 bg-card" />
            {days.map((day, d) => {
              const all = rows.every((_, r) => selected.get(key({ d, r })) === brush);
              return (
                <span key={day} role="columnheader" className="flex pb-2">
                  <button
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-label={`${all ? 'Снять' : 'Отметить'} весь день: ${formatDayLong(day)}`}
                    className="ui-dim ui-focus flex w-full flex-col items-center rounded-cell leading-tight"
                  >
                    <span className="text-small font-bold">{formatWeekday(day)}</span>
                    <span className="text-caption text-ink-muted">{formatDayShort(day)}</span>
                  </button>
                </span>
              );
            })}
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
                const k = slotKey(day, min);
                const level = selected.get(k);
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    data-cell={k}
                    tabIndex={focus.d === d && focus.r === r ? 0 : -1}
                    aria-pressed={!!level}
                    aria-label={`${formatDayLong(day)}, ${hhmm(min)}–${hhmm(min + event.slotStepMin)}${
                      level === 1 ? ', если очень надо' : ''
                    }`}
                    onFocus={() => setFocus(c)}
                    onPointerDown={(e) => {
                      lastPointer.current = e.pointerType;
                      if (e.pointerType !== 'mouse' || e.button !== 0) return;
                      // Начали с клетки этого же уровня — стираем, иначе — красим кистью
                      const on = level !== brush;
                      paint.current = { from: c, on, base: new Map(selected) };
                      setPainting(true);
                      applyRect(paint.current.base, c, c, on);
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== 'mouse') return;
                      setHover(c);
                      if (paint.current)
                        applyRect(paint.current.base, paint.current.from, c, paint.current.on);
                    }}
                    onClick={(e) => {
                      // Клавиатура (detail = 0) — переключить клетку; касание — начало/конец отрезка.
                      // Мышь уже всё сделала на pointerdown.
                      if (e.detail === 0) applyRect(selected, c, c, level !== brush);
                      else if (lastPointer.current !== 'mouse') onTap(c);
                    }}
                    className="ui-focus relative rounded-cell pointer-fine:hover:bg-signal/10"
                    style={
                      hint && hint.total > 0
                        ? {
                            background: `color-mix(in oklab, var(--color-signal) ${Math.round(
                              (hint.count(k) / hint.total) * 45,
                            )}%, transparent)`,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}

          {/* Конец дня под последней строкой */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 z-30 translate-y-1/2 font-mono text-caption tabular text-ink-muted"
            style={{ gridColumn: 1, gridRow: `${rows.length + 1}` }}
          >
            {event.dayEnd}
          </span>

          {/* Линия-курсор с точным временем (только мышь) */}
          {hover && !painting && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 border-t border-ink/40"
                style={{ gridColumn: '2 / -1', gridRow: `${hover.r + 2}` }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 left-0 z-30 -translate-y-1/2 rounded-cell bg-ink px-1 font-mono text-caption tabular text-on-signal"
                style={{ gridColumn: 1, gridRow: `${hover.r + 2}` }}
              >
                {hhmm(rows[hover.r])}
              </span>
            </>
          )}

          {/* Отрезки: «свободен» — сплошной, «если очень надо» — пунктирный */}
          {segments.map((s) => {
            const h = (s.r1 - s.r0) * rowH;
            const active = !!shown && shown.d === s.d && shown.r0 === s.r0;
            const label = `${hhmm(rows[s.r0])}–${end(s)}`;
            const solid = s.level === 2;
            return (
              <div
                key={`${s.d}-${s.r0}`}
                className="pointer-events-none absolute inset-x-0.5 inset-y-px z-10"
                style={area(s.d, s.r0, s.r1)}
              >
                <div
                  className={`flex h-full flex-col overflow-hidden rounded-control px-1 font-mono text-caption leading-tight ${
                    solid
                      ? 'bg-signal text-on-signal'
                      : 'border-2 border-dashed border-signal bg-card text-signal'
                  } ${h >= 40 ? 'py-1' : 'justify-center'} ${
                    active ? 'ring-2 ring-ink ring-offset-1 ring-offset-card' : ''
                  }`}
                >
                  {h >= 40 ? (
                    <>
                      <span className="truncate">{hhmm(rows[s.r0])}</span>
                      <span className="truncate">–{end(s)}</span>
                    </>
                  ) : (
                    h >= 16 && <span className="truncate">{hhmm(rows[s.r0])}</span>
                  )}
                  {h >= 72 && (
                    <span className="mt-auto truncate font-sans opacity-85">
                      {solid ? formatDuration((s.r1 - s.r0) * event.slotStepMin) : 'если надо'}
                    </span>
                  )}
                </div>
                {active && (
                  <>
                    <span
                      aria-hidden
                      data-handle="top"
                      onPointerDown={(e) => startResize(e, s, 'top')}
                      className="pointer-events-auto absolute -top-2 left-1/2 flex h-4 w-10 -translate-x-1/2 cursor-ns-resize touch-none items-center justify-center"
                    >
                      <span className="h-1.5 w-7 rounded-pill bg-ink" />
                    </span>
                    <span
                      aria-hidden
                      data-handle="bottom"
                      onPointerDown={(e) => startResize(e, s, 'bottom')}
                      className="pointer-events-auto absolute -bottom-2 left-1/2 flex h-4 w-10 -translate-x-1/2 cursor-ns-resize touch-none items-center justify-center"
                    >
                      <span className="h-1.5 w-7 rounded-pill bg-ink" />
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Удалить отрезок ${label}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeSeg(s)}
                      className="pointer-events-auto absolute -top-2 -right-2 grid size-5 place-items-center rounded-pill bg-ink text-on-signal"
                    >
                      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                        <path
                          d="M3 3l6 6M9 3l-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* Касание: отмеченное начало отрезка */}
          {anchor && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0.5 inset-y-px z-10 rounded-control border-2 border-signal bg-card"
              style={area(anchor.d, anchor.r, anchor.r + 1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SaveStatus({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <p className="flex items-center gap-2 text-small text-ink-muted" aria-live="polite">
      {state === 'pending' && (
        <>
          <span className="ui-spinner size-3" aria-hidden />
          Сохраняем…
        </>
      )}
      {state === 'saved' && (
        <>
          <svg viewBox="0 0 16 16" className="size-4 text-signal" aria-hidden>
            <path
              d="M3 8.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Сохранено
        </>
      )}
      {state === 'error' && (
        <span className="flex flex-wrap items-center gap-2 text-danger" role="alert">
          Не сохранилось{error ? `: ${error}` : ''}
          <button
            type="button"
            onClick={onRetry}
            className="ui-dim ui-focus rounded-control font-bold underline underline-offset-4"
          >
            Повторить
          </button>
        </span>
      )}
    </p>
  );
}
