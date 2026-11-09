import { useEffect, useRef, type KeyboardEvent } from 'react';
import { THEMES, type ThemeId } from '../lib/themes';
import { useTheme } from '../theme/context';

/** Образец палитры: стеллаж, бумага и чернила. */
function Swatch({ id }: { id: ThemeId }) {
  const t = THEMES.find((x) => x.id === id)!;
  return (
    <span
      aria-hidden
      className="flex size-5 flex-none overflow-hidden rounded-cell border border-rail"
    >
      <span className="flex-1" style={{ background: t.canvas }} />
      <span className="flex-1 bg-white" />
      <span className="flex-1" style={{ background: t.ink }} />
    </span>
  );
}

/** Кнопка «Палитра» в шапке и меню выбора (нативный popover: закрытие по Esc и клику мимо). */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === theme)!;

  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open') return;
      pop.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    };
    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState !== 'open' || !btnRef.current) return;
      // Меню растёт из кнопки: под ней, по правому краю
      const r = btnRef.current.getBoundingClientRect();
      const width = pop.offsetWidth || 224;
      const left = Math.min(r.right - width, window.innerWidth - 16 - width);
      pop.style.top = `${r.bottom + 8}px`;
      pop.style.left = `${Math.max(16, left)}px`;
    };
    pop.addEventListener('beforetoggle', onBeforeToggle);
    pop.addEventListener('toggle', onToggle);
    return () => {
      pop.removeEventListener('beforetoggle', onBeforeToggle);
      pop.removeEventListener('toggle', onToggle);
    };
  }, []);

  function choose(id: ThemeId) {
    setTheme(id);
    popRef.current?.hidePopover();
    btnRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [
      ...(popRef.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        popoverTarget="theme-menu"
        aria-haspopup="menu"
        aria-label={`Палитра: ${current.name}`}
        className="ui-dim ui-focus flex items-center gap-2 rounded-control px-1.5 py-1 text-small sm:px-2 font-bold text-on-canvas-muted hover:text-on-canvas"
      >
        <Swatch id={theme} />
        <span className="hidden sm:inline">Палитра</span>
      </button>

      <div
        ref={popRef}
        id="theme-menu"
        popover="auto"
        role="menu"
        aria-label="Палитра"
        onKeyDown={onKeyDown}
        className="paper ui-pop-in fixed inset-auto m-0 w-56 flex-col gap-1 rounded-card p-2 shadow-lg open:flex"
        style={{ ['--ui-origin' as string]: 'top right' }}
      >
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="menuitemradio"
            aria-checked={t.id === theme}
            onClick={() => choose(t.id)}
            className={`ui-press ui-press--surface ui-focus flex items-center gap-2 rounded-control px-2 py-2 text-left ${
              t.id === theme ? 'bg-card-sunk' : ''
            }`}
          >
            <Swatch id={t.id} />
            <span className="flex flex-1 flex-col">
              <span className="text-small font-bold">{t.name}</span>
              <span className="text-caption text-ink-muted">{t.tone}</span>
            </span>
            {t.id === theme && (
              <svg viewBox="0 0 16 16" className="size-4 flex-none text-signal" aria-hidden>
                <path
                  d="M3 8.5l3 3 7-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
