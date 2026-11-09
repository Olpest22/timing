import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  DAY_NAMES,
  DAYS,
  DURATION,
  FIRST_HOUR,
  HEAT_BG,
  HOURS,
  TOTAL,
  YOU,
  cellKey,
  freeCount,
  isFree,
  time,
  type Best,
} from '../lib/demo';

type Props = {
  mine: Set<string>;
  setCell: (key: string, on: boolean) => void;
  best: Best;
  /** Имя участника, чьи часы показать вместо общей карты (из стеллажа) */
  spotlight: string | null;
};

/**
 * Карточка табеля: бланк мероприятия и сетка «дни × часы». Плотность чернил — сколько людей
 * свободно; ваши отметки — пробитые отверстия; лучший слот обведён рамкой.
 */
export function TimeCard({ mine, setCell, best, spotlight }: Props) {
  const [focus, setFocus] = useState({ day: best.day, hour: best.hour });
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);
  const paint = useRef<{ on: boolean } | null>(null);
  const lastPointer = useRef('mouse');
  const gridRef = useRef<HTMLDivElement>(null);

  // Мышью можно провести по клеткам; отпускание где угодно заканчивает отметку
  useEffect(() => {
    const stop = () => (paint.current = null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

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
    const day = Math.min(DAYS.length - 1, Math.max(0, focus.day + m[0]));
    const hour = Math.min(HOURS[HOURS.length - 1], Math.max(FIRST_HOUR, focus.hour + m[1]));
    setFocus({ day, hour });
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${cellKey(day, hour)}"]`)?.focus();
  }

  const tip = hover;

  return (
    <section
      aria-labelledby="card-title"
      className="paper relative rounded-card px-4 pt-8 pb-4 sm:px-6 sm:pb-6"
      data-sample="команда, мероприятие и расписание — образец для демонстрации"
    >
      {/* Вырез, которым карточка вставляется в табельные часы */}
      <span
        aria-hidden
        data-ui-edge
        className="absolute top-0 left-1/2 h-4 w-12 -translate-x-1/2 rounded-b-pill bg-canvas"
      />

      <dl className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2 flex flex-col border-b border-rule pb-2">
          <dt className="text-caption text-ink-muted">Мероприятие</dt>
          <dd id="card-title" className="font-display text-h2">
            Ретро спринта
          </dd>
        </div>
        <div className="flex flex-col border-b border-rule py-2">
          <dt className="text-caption text-ink-muted">Длительность</dt>
          <dd className="text-small font-bold">2 часа</dd>
        </div>
        <div className="flex flex-col border-b border-rule py-2">
          <dt className="text-caption text-ink-muted">Неделя</dt>
          <dd className="text-small font-bold">16–20 ноября</dd>
        </div>
      </dl>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Свободное время команды. Нажмите на клетку, чтобы отметить, что вы свободны"
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
        className="relative mt-4 grid select-none grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] gap-1"
      >
        <div role="row" className="contents">
          <span role="columnheader" aria-label="Время" />
          {DAYS.map((d, i) => (
            <span
              key={d}
              role="columnheader"
              aria-label={DAY_NAMES[i]}
              className="pb-1 text-center text-small font-bold"
            >
              {d}
            </span>
          ))}
        </div>

        {HOURS.map((hour) => (
          <div role="row" key={hour} className="contents">
            <span
              role="rowheader"
              className="flex items-center font-mono text-caption tabular text-ink-muted"
            >
              {hour}
            </span>
            {DAYS.map((_, day) => {
              const k = cellKey(day, hour);
              const isMine = mine.has(k);
              const count = freeCount(day, hour, mine);
              const lit = spotlight ? isFree(spotlight, day, hour, mine) : null;
              const bg = lit === null ? HEAT_BG[count] : lit ? 'bg-signal' : 'bg-heat-0';
              const focused = focus.day === day && focus.hour === hour;
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  data-cell={k}
                  tabIndex={focused ? 0 : -1}
                  aria-pressed={isMine}
                  aria-label={`${DAY_NAMES[day]}, ${time(hour)}: свободны ${count} из ${TOTAL}${isMine ? ', включая вас' : ''}`}
                  onFocus={() => {
                    setFocus({ day, hour });
                    setHover({ day, hour });
                  }}
                  onBlur={() => setHover(null)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setHover({ day, hour });
                    if (e.pointerType === 'mouse' && paint.current) setCell(k, paint.current.on);
                  }}
                  onPointerDown={(e) => {
                    lastPointer.current = e.pointerType;
                    if (e.pointerType !== 'mouse' || e.button !== 0) return;
                    paint.current = { on: !isMine };
                    setCell(k, !isMine);
                  }}
                  onClick={(e) => {
                    // Мышь уже отметила клетку на pointerdown; клик — для касаний и клавиатуры
                    if (e.detail !== 0 && lastPointer.current === 'mouse') return;
                    setCell(k, !isMine);
                  }}
                  className={`ui-press ui-focus relative grid h-8 place-items-center rounded-cell ${bg} ${count >= 5 || lit ? 'ui-press--on-dark' : ''}`}
                >
                  {isMine && <Punch />}
                </button>
              );
            })}
          </div>
        ))}

        {!spotlight && <BestFrame day={best.day} hour={best.hour} />}
        {tip && <Tip day={tip.day} hour={tip.hour} mine={mine} spotlight={spotlight} />}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-ink-muted">
        <span className="flex items-center gap-2 whitespace-nowrap">
          никого
          <span className="flex gap-0.5" aria-hidden>
            {HEAT_BG.map((bg) => (
              <span key={bg} className={`h-3 w-3 rounded-cell ${bg}`} />
            ))}
          </span>
          все {TOTAL}
        </span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className="relative grid size-4 place-items-center rounded-cell bg-heat-3"
          >
            <Punch />
          </span>
          ваша отметка
        </span>
      </div>
    </section>
  );
}

/** Пробитое отверстие: видно сквозь бумагу тёмную сталь стеллажа. */
function Punch() {
  return <span aria-hidden className="punch-in size-2.5 rounded-pill bg-canvas" />;
}

/** Подсказка над клеткой: точное число и день. */
function Tip({
  day,
  hour,
  mine,
  spotlight,
}: {
  day: number;
  hour: number;
  mine: Set<string>;
  spotlight: string | null;
}) {
  const count = freeCount(day, hour, mine);
  const text = spotlight
    ? `${spotlight === YOU ? 'вы' : spotlight}: ${isFree(spotlight, day, hour, mine) ? 'может' : 'не может'}`
    : `свободны ${count} из ${TOTAL}`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 flex -translate-x-1/2 flex-col items-center rounded-control bg-ink px-2 py-1 text-center whitespace-nowrap text-on-signal"
      style={{ gridColumn: `${day + 2} / span 1`, gridRow: `${hour - FIRST_HOUR + 2} / span 1` }}
    >
      <span className="text-caption">
        {DAYS[day]}, {time(hour)}
      </span>
      <span className="text-small font-bold">{text}</span>
    </div>
  );
}

/** Рамка лучшего слота. При пересчёте переезжает на новое место (FLIP). */
function BestFrame({ day, hour }: { day: number; hour: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.getBoundingClientRect();
    const was = prev.current;
    prev.current = next;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!was || reduce || (was.x === next.x && was.y === next.y)) return;
    el.animate(
      [{ transform: `translate(${was.x - next.x}px, ${was.y - next.y}px)` }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
  }, [day, hour]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute -inset-1 rounded-frame border-2 border-ink"
      style={{
        gridColumn: `${day + 2} / span 1`,
        gridRow: `${hour - FIRST_HOUR + 2} / span ${DURATION}`,
      }}
    />
  );
}
