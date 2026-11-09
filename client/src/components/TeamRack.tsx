import { DAYS, HOURS, TEAM, YOU, isFree } from '../lib/demo';

type Props = {
  mine: Set<string>;
  spotlight: string | null;
  pinned: string | null;
  onHover: (name: string | null) => void;
  onPin: (name: string | null) => void;
};

/**
 * Стеллаж карточек: у каждого участника своя карточка с его часами. Общая карта —
 * это все карточки, сложенные стопкой. Наведение или фокус показывает часы одного человека.
 */
export function TeamRack({ mine, spotlight, pinned, onHover, onPin }: Props) {
  const people = [...TEAM.map((m) => m.name), YOU];
  return (
    <section aria-labelledby="rack-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="rack-title" className="font-display text-h2">
          Карточки команды
        </h2>
        <p className="text-small text-on-canvas-muted">
          Выберите карточку, чтобы увидеть в табеле часы одного человека.
        </p>
      </div>
      <div
        className="grid grid-cols-4 gap-2 rounded-card bg-canvas-deep p-2 sm:gap-4 sm:p-4 lg:grid-cols-7"
        onPointerLeave={() => onHover(null)}
      >
        {people.map((name) => {
          const you = name === YOU;
          const hours = DAYS.flatMap((_, day) =>
            HOURS.filter((h) => isFree(name, day, h, mine)),
          ).length;
          const empty = you && hours === 0;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={pinned === name}
              aria-label={`${you ? 'Ваша карточка' : name}: ${hours} ч свободно. Показать в табеле`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(name)}
              onFocus={() => onHover(name)}
              onBlur={() => onHover(null)}
              onClick={() => onPin(pinned === name ? null : name)}
              className={`ui-press ui-press--surface ui-focus flex flex-col gap-2 rounded-control p-2 text-left ${
                empty ? 'border border-dashed border-rail text-on-canvas' : 'paper'
              } ${spotlight === name ? 'ring-2 ring-on-canvas ring-offset-2 ring-offset-canvas-deep' : ''}`}
            >
              <span className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between lg:gap-1">
                <span className="text-small font-bold">{you ? 'Вы' : name}</span>
                <span
                  className={`font-mono text-caption tabular ${empty ? 'text-on-canvas-muted' : 'text-ink-muted'}`}
                >
                  {hours} ч
                </span>
              </span>
              {empty ? (
                <span className="text-caption text-on-canvas-muted">отметьте часы в табеле</span>
              ) : (
                <MiniGrid name={name} mine={mine} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MiniGrid({ name, mine }: { name: string; mine: Set<string> }) {
  return (
    <span aria-hidden className="grid grid-cols-5 gap-px">
      {HOURS.map((h) =>
        DAYS.map((_, day) => (
          <span
            key={`${day}-${h}`}
            className={`h-1 rounded-[1px] ${isFree(name, day, h, mine) ? 'bg-signal' : 'bg-heat-0'}`}
          />
        )),
      )}
    </span>
  );
}
