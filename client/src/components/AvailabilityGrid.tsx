import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  eventDays,
  eventRows,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatWeekday,
  hhmm,
  slotKey,
  type TimingEvent,
} from '../lib/events';
import type { SaveState } from '../lib/useAvailability';

type Props = {
  event: TimingEvent;
  selected: Set<string>;
  setCells: (keys: string[], on: boolean) => void;
  saveState: SaveState;
  saveError: string | null;
  onRetry: () => void;
};

/**
 * Сетка «дни × клетки» для своих отметок. Мышью можно провести по клеткам, касанием —
 * нажимать по одной, заголовок дня отмечает или снимает весь день, стрелки двигают фокус.
 */
export function AvailabilityGrid({
  event,
  selected,
  setCells,
  saveState,
  saveError,
  onRetry,
}: Props) {
  const days = useMemo(() => eventDays(event), [event]);
  const rows = useMemo(() => eventRows(event), [event]);
  const [focus, setFocus] = useState({ d: 0, r: 0 });
  const paint = useRef<{ on: boolean } | null>(null);
  const lastPointer = useRef('mouse');
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Затухание у края, за которым есть ещё дни (только если сетка шире карточки)
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
  const compact = event.slotStepMin === 15;

  useEffect(() => {
    const stop = () => (paint.current = null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  function moveFocus(d: number, r: number) {
    const nd = Math.min(days.length - 1, Math.max(0, d));
    const nr = Math.min(rows.length - 1, Math.max(0, r));
    setFocus({ d: nd, r: nr });
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-cell="${slotKey(days[nd], rows[nr])}"]`)
      ?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    moveFocus(focus.d + m[0], focus.r + m[1]);
  }

  function toggleDay(day: string) {
    const keys = rows.map((min) => slotKey(day, min));
    setCells(keys, !keys.every((k) => selected.has(k)));
  }

  const markedMin = selected.size * event.slotStepMin;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-small">
          {selected.size > 0 ? (
            <>
              Вы свободны: <b className="font-mono tabular">{formatDuration(markedMin)}</b>
            </>
          ) : (
            'Отметьте клетки, когда вы свободны.'
          )}
        </p>
        <SaveStatus state={saveState} error={saveError} onRetry={onRetry} />
      </div>

      <div
        ref={scrollRef}
        className="scroll-fade -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8"
        data-fade-left={edges.left || undefined}
        data-fade-right={edges.right || undefined}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label="Ваше свободное время. Нажмите на клетку, чтобы отметить её"
          aria-rowcount={rows.length + 1}
          onKeyDown={onKeyDown}
          className="grid w-max min-w-full select-none gap-1"
          style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(2.75rem, 1fr))` }}
        >
          <div role="row" className="contents">
            <span role="columnheader" aria-label="Время" className="sticky left-0 z-10 bg-card" />
            {days.map((day) => {
              const all = rows.every((min) => selected.has(slotKey(day, min)));
              return (
                <span key={day} role="columnheader" className="flex">
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-label={`${all ? 'Снять' : 'Отметить'} весь день: ${formatDayLong(day)}`}
                    className="ui-dim ui-focus flex w-full flex-col items-center rounded-cell pb-1 leading-tight"
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
                className="sticky left-0 z-10 flex items-center bg-card pr-1 font-mono text-caption tabular text-ink-muted"
              >
                {compact && min % 60 !== 0 ? '' : hhmm(min)}
              </span>
              {days.map((day, d) => {
                const k = slotKey(day, min);
                const on = selected.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    data-cell={k}
                    tabIndex={focus.d === d && focus.r === r ? 0 : -1}
                    aria-pressed={on}
                    aria-label={`${formatDayLong(day)}, ${hhmm(min)}–${hhmm(min + event.slotStepMin)}`}
                    onFocus={() => setFocus({ d, r })}
                    onPointerDown={(e) => {
                      lastPointer.current = e.pointerType;
                      if (e.pointerType !== 'mouse' || e.button !== 0) return;
                      paint.current = { on: !on };
                      setCells([k], !on);
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse' && paint.current)
                        setCells([k], paint.current.on);
                    }}
                    onClick={(e) => {
                      // Мышь уже отметила клетку на pointerdown; клик — для касаний и клавиатуры
                      if (e.detail !== 0 && lastPointer.current === 'mouse') return;
                      setCells([k], !on);
                    }}
                    className={`ui-press ui-focus relative grid place-items-center rounded-cell ${compact ? 'h-5' : 'h-7'} ${
                      on ? 'ui-press--on-dark bg-signal' : 'bg-card-sunk'
                    }`}
                  >
                    {on && (
                      <span
                        aria-hidden
                        className={`punch-in rounded-pill bg-punch ${compact ? 'size-1.5' : 'size-2'}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
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
