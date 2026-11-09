import { DAYS, DURATION, TOTAL, listNames, time, type Best } from '../lib/demo';

/** Оттиск табельных часов с ответом: лучшее окно и кто не сможет. */
export function Stamp({ best }: { best: Best }) {
  const slot = `${DAYS[best.day].toUpperCase()} ${time(best.hour)}–${time(best.hour + DURATION)}`;
  return (
    <div className="paper flex flex-col gap-2 rounded-control px-4 py-4 sm:px-6" aria-live="polite">
      <span className="text-caption text-ink-muted">Лучшее время по табелю</span>
      {/* key: при пересчёте оттиск «бьёт» заново */}
      <span
        key={slot}
        className="stamp-hit font-mono text-stamp-sm font-semibold tabular text-signal sm:text-stamp"
      >
        {slot}
      </span>
      <span key={best.count + best.missing.join()} className="stamp-hit text-small">
        <b>
          свободны {best.count} из {TOTAL}
        </b>
        {best.missing.length > 0 && (
          <span className="text-ink-muted">, не могут {listNames(best.missing)}</span>
        )}
      </span>
    </div>
  );
}
