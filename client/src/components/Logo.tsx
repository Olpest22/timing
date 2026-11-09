/** Знак: четыре клетки табеля, одна пробита часами. */
export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-h2 text-ink">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="1" y="1" width="10" height="10" rx="2" className="fill-ink" />
        <rect x="13" y="1" width="10" height="10" rx="2" className="fill-ink" />
        <rect x="1" y="13" width="10" height="10" rx="2" className="fill-ink" />
        <rect x="13" y="13" width="10" height="10" rx="2" className="fill-signal" />
        <circle cx="18" cy="18" r="2" className="fill-card" />
      </svg>
      Тайминг
    </span>
  );
}
