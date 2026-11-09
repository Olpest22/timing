import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

/*
 * Демо-карточка на главной. Команда и её время — образец (data-sample), посетитель отмечает
 * своё время и видит, как меняются тепловая карта и лучший слот. Та же модель, что будет
 * у настоящих мероприятий на этапах 3–5.
 */

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'];
const FIRST_HOUR = 10;
const HOURS = Array.from({ length: 10 }, (_, i) => FIRST_HOUR + i); // 10:00 … 19:00
const DURATION = 2; // часа

type Range = [from: number, to: number]; // [10, 13) — свободен с 10:00 до 13:00
const TEAM: { name: string; days: Range[] }[] = [
  {
    name: 'Аня',
    days: [
      [10, 13],
      [14, 20],
      [10, 12],
      [15, 20],
      [10, 14],
    ],
  },
  {
    name: 'Петя',
    days: [
      [16, 20],
      [10, 12],
      [13, 18],
      [16, 20],
      [15, 18],
    ],
  },
  {
    name: 'Олег',
    days: [
      [10, 12],
      [15, 19],
      [10, 15],
      [10, 13],
      [12, 17],
    ],
  },
  {
    name: 'Маша',
    days: [
      [13, 18],
      [16, 20],
      [17, 20],
      [14, 20],
      [10, 12],
    ],
  },
  {
    name: 'Дима',
    days: [
      [11, 15],
      [10, 13],
      [15, 20],
      [17, 20],
      [13, 19],
    ],
  },
  {
    name: 'Лена',
    days: [
      [17, 20],
      [12, 17],
      [10, 13],
      [16, 19],
      [16, 20],
    ],
  },
];
const TOTAL = TEAM.length + 1; // + вы

const key = (day: number, hour: number) => `${day}-${hour}`;
const time = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

function freeNames(day: number, hour: number): string[] {
  return TEAM.filter(({ days }) => hour >= days[day][0] && hour < days[day][1]).map((m) => m.name);
}

/** Уровень чернил 0–5 по доле свободных. */
function heatLevel(count: number) {
  return count === 0 ? 0 : Math.ceil((count / TOTAL) * 5);
}

const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4', 'bg-heat-5'];

type Best = { day: number; hour: number; count: number; missing: string[] };

function findBest(mine: Set<string>): Best {
  const everyone = [...TEAM.map((m) => m.name), 'вы'];
  let best: Best = { day: 0, hour: FIRST_HOUR, count: -1, missing: [] };
  for (let day = 0; day < DAYS.length; day++) {
    for (const hour of HOURS.slice(0, HOURS.length - DURATION + 1)) {
      // Свободен на весь интервал — значит свободен в каждом его часе
      const hours = Array.from({ length: DURATION }, (_, i) => hour + i);
      const free = everyone.filter((name) =>
        hours.every((h) =>
          name === 'вы' ? mine.has(key(day, h)) : freeNames(day, h).includes(name),
        ),
      );
      // строго больше: при равенстве остаётся более ранний слот
      if (free.length > best.count) {
        best = {
          day,
          hour,
          count: free.length,
          missing: everyone.filter((n) => !free.includes(n)),
        };
      }
    }
  }
  return best;
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

export function TimeCardDemo() {
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState({ day: 3, hour: 17 });
  const paint = useRef<{ on: boolean } | null>(null);
  const lastPointer = useRef<string>('mouse');
  const gridRef = useRef<HTMLDivElement>(null);

  const best = useMemo(() => findBest(mine), [mine]);

  const set = useCallback((k: string, on: boolean) => {
    setMine((prev) => {
      if (prev.has(k) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  }, []);

  // Мышью можно «провести» по клеткам; отпускание где угодно заканчивает отметку
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
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${key(day, hour)}"]`)?.focus();
  }

  const bestLabel = `${DAY_NAMES[best.day]}, ${time(best.hour)}–${time(best.hour + DURATION)}`;

  return (
    <section
      aria-labelledby="demo-title"
      className="rounded-card bg-card p-4 sm:p-8"
      data-sample="команда, мероприятие и расписание — образец для демонстрации"
    >
      <header className="flex flex-col gap-4 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="flex flex-col gap-1">
          <h2 id="demo-title" className="font-display text-h1">
            Ретро спринта
          </h2>
          <p className="text-small text-ink-muted">
            7 участников, встреча на 2 часа, неделя 16–20 ноября
          </p>
        </div>
        <BestSlot label={bestLabel} best={best} />
      </header>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Свободное время команды. Нажмите на клетку, чтобы отметить, что вы свободны"
        onKeyDown={onKeyDown}
        className="relative mt-4 grid select-none grid-cols-[3rem_repeat(5,minmax(0,1fr))] gap-1 sm:mt-6"
      >
        <div role="row" className="contents">
          <span role="columnheader" aria-label="Время" />
          {DAYS.map((d, i) => (
            <span
              key={d}
              role="columnheader"
              aria-label={DAY_NAMES[i]}
              className="pb-1 text-center font-display text-h2"
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
              {time(hour)}
            </span>
            {DAYS.map((_, day) => {
              const k = key(day, hour);
              const isMine = mine.has(k);
              const count = freeNames(day, hour).length + (isMine ? 1 : 0);
              const level = heatLevel(count);
              const dark = level >= 4;
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
                  onFocus={() => setFocus({ day, hour })}
                  onPointerDown={(e) => {
                    lastPointer.current = e.pointerType;
                    if (e.pointerType !== 'mouse' || e.button !== 0) return;
                    paint.current = { on: !isMine };
                    set(k, !isMine);
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse' && paint.current) set(k, paint.current.on);
                  }}
                  onClick={(e) => {
                    // Мышь уже отметила клетку на pointerdown; клик — для касаний и клавиатуры
                    if (e.detail !== 0 && lastPointer.current === 'mouse') return;
                    set(k, !isMine);
                  }}
                  className={`ui-press ui-focus relative flex h-9 items-center justify-center rounded-cell font-mono text-caption tabular ${HEAT_BG[level]} ${
                    dark ? 'ui-press--on-dark text-on-signal' : 'text-ink'
                  }`}
                >
                  {count}
                  {isMine && <Punch dark={dark} />}
                </button>
              );
            })}
          </div>
        ))}

        <BestFrame day={best.day} hour={best.hour} />
      </div>

      <footer className="mt-4 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
        <Legend />
        <p className="text-small text-ink-muted">
          Отметьте клетки, когда свободны вы
          <span className="hidden pointer-fine:inline">: нажмите или проведите мышью</span>.
        </p>
      </footer>
    </section>
  );
}

function BestSlot({ label, best }: { label: string; best: Best }) {
  return (
    <div className="flex flex-col gap-1 sm:items-end sm:text-right" aria-live="polite">
      <span className="text-small text-ink-muted">Лучшее время</span>
      {/* key: при смене значения строка заново «пропечатывается» */}
      <span key={label} className="stamp-in font-display text-h2">
        {label}
      </span>
      <span key={best.count + best.missing.join()} className="stamp-in text-small">
        свободны {best.count} из {TOTAL}
        {best.missing.length > 0 && <>, не могут {listNames(best.missing)}</>}
      </span>
    </div>
  );
}

/** Пробитое отверстие: ваша отметка, видна без цвета. */
function Punch({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute top-1 right-1 size-2 rounded-pill border bg-canvas ${dark ? 'border-on-signal' : 'border-edge'}`}
    />
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

function Legend() {
  return (
    <div className="flex items-center gap-2 text-caption text-ink-muted">
      <span>0</span>
      <span className="flex gap-1" aria-hidden>
        {HEAT_BG.map((bg) => (
          <span key={bg} className={`h-3 w-6 rounded-cell ${bg}`} />
        ))}
      </span>
      <span>{TOTAL} свободны</span>
    </div>
  );
}
