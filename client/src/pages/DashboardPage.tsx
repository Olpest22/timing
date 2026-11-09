import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button, ButtonLink } from '../components/Button';
import { ApiError } from '../lib/api';
import {
  deadlineLeft,
  finalSlot,
  formatSlotRange,
  bucketOf,
  eventsApi,
  formatDateRange,
  formatDuration,
  plural,
  type TimingEvent,
} from '../lib/events';

const SLOTS = [
  { id: 'waiting', title: 'Ждут ответов' },
  { id: 'scheduled', title: 'Время назначено' },
  { id: 'past', title: 'Прошли' },
] as const;

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ok'; events: TimingEvent[] };

export function DashboardPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchEvents = useCallback(
    () =>
      eventsApi
        .list()
        .then((events) => setLoad({ state: 'ok', events }))
        .catch((e) =>
          setLoad({
            state: 'error',
            message: e instanceof ApiError ? e.message : 'Сервер недоступен',
          }),
        ),
    [],
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function retry() {
    setLoad({ state: 'loading' });
    fetchEvents();
  }

  const events = load.state === 'ok' ? load.events : [];
  const myTurn = events.filter((e) => bucketOf(e) === 'waiting' && e.me && !e.me.responded).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h1">Мероприятия</h1>
          {load.state === 'ok' && events.length > 0 && (
            <p className="text-body text-on-canvas-muted">
              {myTurn > 0 ? (
                <>
                  <span className="font-mono text-h2 font-semibold tabular text-on-canvas">
                    {myTurn}
                  </span>{' '}
                  {plural(myTurn, ['мероприятие ждёт', 'мероприятия ждут', 'мероприятий ждут'])}{' '}
                  вашей отметки
                </>
              ) : (
                'Вы отметили время во всех открытых мероприятиях.'
              )}
            </p>
          )}
        </div>
        <ButtonLink to="/events/new" variant="cta">
          Создать мероприятие
        </ButtonLink>
      </div>

      {load.state === 'error' && (
        <div
          className="paper flex flex-wrap items-center justify-between gap-4 rounded-control p-4"
          role="alert"
        >
          <span className="text-small">Не удалось загрузить мероприятия: {load.message}</span>
          <Button variant="secondary" onClick={retry}>
            Повторить
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {SLOTS.map((slot, i) => {
          const items = events.filter((e) => bucketOf(e) === slot.id);
          return (
            <section
              key={slot.id}
              aria-labelledby={`slot-${slot.id}`}
              aria-busy={load.state === 'loading'}
              className="flex min-h-40 flex-col gap-2 rounded-card bg-canvas-deep p-2 sm:p-4"
            >
              <h2
                id={`slot-${slot.id}`}
                className="flex items-baseline justify-between px-2 pb-2 text-small font-bold sm:px-0"
              >
                {slot.title}
                {load.state === 'ok' && (
                  <span className="font-mono text-caption font-normal tabular text-on-canvas-muted">
                    {items.length}
                  </span>
                )}
              </h2>

              {load.state === 'loading' && (
                <span className="h-20 animate-pulse rounded-control bg-canvas" />
              )}

              {load.state === 'ok' && items.map((e) => <EventTile key={e.code} event={e} />)}

              {load.state === 'ok' && i === 0 && events.length === 0 && (
                <p className="px-2 text-small text-on-canvas-muted sm:px-0">
                  Создайте мероприятие и разошлите ссылку: здесь будут те, где команда ещё отмечает
                  время.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Карточка мероприятия в ячейке стеллажа. */
function EventTile({ event }: { event: TimingEvent }) {
  const waitingForMe = bucketOf(event) === 'waiting' && event.me && !event.me.responded;
  return (
    <Link
      to={`/e/${event.code}`}
      className="paper ui-press ui-press--surface ui-focus flex flex-col gap-2 rounded-control p-4"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-h2 leading-tight">{event.title}</span>
        {waitingForMe && (
          <span className="mt-1 flex-none rounded-pill bg-signal px-2 text-caption font-bold text-on-signal">
            ваш ход
          </span>
        )}
      </span>
      {finalSlot(event) ? (
        <span className="font-mono text-small font-semibold tabular text-signal">
          {formatSlotRange(finalSlot(event)!, event.durationMin)}
        </span>
      ) : (
        <span className="text-small text-ink-muted">
          {formatDateRange(event.dateFrom, event.dateTo)}, {formatDuration(event.durationMin)}
          {event.deadline && bucketOf(event) === 'waiting' && (
            <>
              <br />
              отметить до {formatDateRange(event.deadline, event.deadline)},{' '}
              {deadlineLeft(event.deadline)}
            </>
          )}
        </span>
      )}
      <span className="flex items-baseline justify-between gap-2 text-caption text-ink-muted">
        <span>
          {event.me?.isOrganizer ? 'вы организатор' : `организатор: ${event.organizer.name}`}
        </span>
        <span className="font-mono tabular">
          отметили {event.respondedCount}/{event.participantCount}
        </span>
      </span>
    </Link>
  );
}
