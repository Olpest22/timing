import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../auth/context';
import { ButtonLink } from '../components/Button';
import { Stamp } from '../components/Stamp';
import { TeamRack } from '../components/TeamRack';
import { TimeCard } from '../components/TimeCard';
import { findBest } from '../lib/demo';

export function HomePage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const best = useMemo(() => findBest(mine), [mine]);
  const spotlight = hovered ?? pinned;

  const setCell = useCallback((k: string, on: boolean) => {
    setMine((prev) => {
      if (prev.has(k) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-12">
        <section className="flex flex-col gap-6 lg:pt-4">
          <h1 className="font-display text-display-sm sm:text-display">
            Найдите время, когда свободны все
          </h1>
          <p className="max-w-xl text-body text-on-canvas-muted">
            Каждый в команде пробивает в табеле свои свободные часы, а «Тайминг» складывает карточки
            и показывает, когда собраться.
          </p>
          <Stamp best={best} />
          <div className="flex flex-wrap items-center gap-4">
            {user ? (
              <ButtonLink to="/dashboard" variant="cta" size="lg">
                Мои мероприятия
              </ButtonLink>
            ) : (
              <ButtonLink to="/register" variant="cta" size="lg">
                Создать аккаунт
              </ButtonLink>
            )}
          </div>
        </section>

        <TimeCard mine={mine} setCell={setCell} best={best} spotlight={spotlight} />
      </div>

      <TeamRack
        mine={mine}
        spotlight={spotlight}
        pinned={pinned}
        onHover={setHovered}
        onPin={setPinned}
      />
    </div>
  );
}
