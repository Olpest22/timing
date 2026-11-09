import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/context';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { Button, ButtonLink } from '../components/Button';
import { FormError } from '../components/form';
import { ApiError } from '../lib/api';
import { useAvailability } from '../lib/useAvailability';
import { useHeatmap } from '../lib/useHeatmap';
import {
  daysBetween,
  eventsApi,
  formatDateRange,
  formatDuration,
  inviteUrl,
  plural,
  type Heatmap,
  type TimingEvent,
} from '../lib/events';

type Tab = 'mine' | 'team';

type Load =
  | { state: 'loading' }
  | { state: 'error'; status: number; message: string }
  | { state: 'ok'; event: TimingEvent };

export function EventPage() {
  const { code = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const justCreated = (useLocation().state as { justCreated?: boolean } | null)?.justCreated;
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchEvent = useCallback(
    () =>
      eventsApi
        .get(code)
        .then((event) => setLoad({ state: 'ok', event }))
        .catch((e) =>
          setLoad({
            state: 'error',
            status: e instanceof ApiError ? e.status : 0,
            message: e instanceof ApiError ? e.message : 'Сервер недоступен',
          }),
        ),
    [code],
  );

  const loaded = load.state === 'ok' ? load.event : null;
  const { heat, refetch: refetchHeat } = useHeatmap(code, !!loaded?.me);
  const [tab, setTab] = useState<Tab | null>(null);
  // Вкладка выбирается один раз при загрузке: ещё не отметился — «Моё время», иначе —
  // общая карта. Потом сама не переключается (иначе первое сохранение уводило бы со своей сетки).
  if (tab === null && loaded) setTab(loaded.me?.responded ? 'team' : 'mine');
  const [spotlight, setSpotlight] = useState<number | null>(null);

  // После своего сохранения обновляем счётчики участников и общую карту
  const onSaved = useCallback(() => {
    fetchEvent();
    refetchHeat();
  }, [fetchEvent, refetchHeat]);

  // Ждём восстановления сессии: от неё зависит, видны ли участники
  useEffect(() => {
    if (!authLoading) fetchEvent();
  }, [authLoading, fetchEvent, user?.id]);

  if (load.state === 'loading') return <EventSkeleton />;
  if (load.state === 'error') {
    return (
      <div className="flex flex-col items-start gap-4 pt-8">
        <h1 className="font-display text-h1">
          {load.status === 404 ? 'Мероприятие не найдено' : 'Не удалось загрузить'}
        </h1>
        <p className="text-on-canvas-muted">
          {load.status === 404 ? 'Проверьте ссылку: возможно, в ней опечатка.' : load.message}
        </p>
        {load.status === 404 ? (
          <ButtonLink to={user ? '/dashboard' : '/'} variant="cta">
            {user ? 'К мероприятиям' : 'На главную'}
          </ButtonLink>
        ) : (
          <Button variant="secondary" onClick={() => fetchEvent()}>
            Повторить
          </Button>
        )}
      </div>
    );
  }

  const { event } = load;
  const activeTab: Tab = tab ?? 'mine';
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
      <EventCard
        event={event}
        onSaved={onSaved}
        tab={activeTab}
        setTab={setTab}
        heat={heat}
        spotlight={spotlight}
      />
      <aside className="flex flex-col gap-6">
        {event.me ? (
          <>
            <Invite code={event.code} highlight={!!justCreated} />
            <People
              event={event}
              spotlight={activeTab === 'team' ? spotlight : null}
              onPick={(id) => {
                setSpotlight((s) => (s === id && activeTab === 'team' ? null : id));
                setTab('team');
              }}
            />
          </>
        ) : (
          <JoinPanel event={event} onJoined={(e) => setLoad({ state: 'ok', event: e })} />
        )}
      </aside>
    </div>
  );
}

/** Карточка мероприятия — бланк табеля. */
function EventCard({
  event,
  onSaved,
  tab,
  setTab,
  heat,
  spotlight,
}: {
  event: TimingEvent;
  onSaved: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  heat: Heatmap | null;
  spotlight: number | null;
}) {
  const days = daysBetween(event.dateFrom, event.dateTo);
  return (
    <section
      aria-labelledby="event-title"
      className="paper relative rounded-card px-4 pt-10 pb-6 sm:px-8 sm:pb-8"
    >
      <span
        aria-hidden
        data-ui-edge
        className="absolute top-0 left-1/2 h-4 w-12 -translate-x-1/2 rounded-b-pill bg-canvas"
      />
      <dl className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2 flex flex-col border-b border-rule pb-2">
          <dt className="text-caption text-ink-muted">Мероприятие</dt>
          <dd id="event-title" className="font-display text-h1">
            {event.title}
          </dd>
        </div>
        <Row label="Организатор" value={event.organizer.name} />
        <Row label="Длительность" value={formatDuration(event.durationMin)} />
        <Row
          label="Даты"
          value={`${formatDateRange(event.dateFrom, event.dateTo)}, ${days} ${plural(days, ['день', 'дня', 'дней'])}`}
        />
        <Row
          label="Часы дня"
          value={`${event.dayStart}–${event.dayEnd}, клетка ${event.slotStepMin} мин`}
        />
      </dl>

      {event.description && (
        <p className="mt-4 whitespace-pre-line text-body">{event.description}</p>
      )}

      <div className="mt-6">
        {event.status === 'closed' && event.finalStart ? (
          <Notice>
            Время назначено:{' '}
            {new Date(event.finalStart).toLocaleString('ru-RU', {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: 'UTC',
            })}
          </Notice>
        ) : event.me ? (
          <div className="flex flex-col gap-4">
            <Tabs tab={tab} setTab={setTab} event={event} />
            {/* Обе панели остаются смонтированными: несохранённые отметки не теряются */}
            <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" hidden={tab !== 'mine'}>
              <MyAvailability event={event} onSaved={onSaved} heat={heat} />
            </div>
            <div role="tabpanel" id="panel-team" aria-labelledby="tab-team" hidden={tab !== 'team'}>
              {heat ? (
                <HeatmapGrid
                  event={event}
                  heat={heat}
                  participants={event.participants ?? []}
                  spotlight={spotlight}
                />
              ) : (
                <div
                  className="h-48 animate-pulse rounded-control bg-card-sunk"
                  role="status"
                  aria-label="Загрузка карты"
                />
              )}
            </div>
          </div>
        ) : (
          <Notice>Присоединитесь, чтобы отметить своё время.</Notice>
        )}
      </div>
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-control border border-dashed border-edge px-4 py-6 text-center text-small text-ink-muted">
      {children}
    </div>
  );
}

/** Мои отметки: загрузка, сетка, автосохранение. */
function Tabs({ tab, setTab, event }: { tab: Tab; setTab: (t: Tab) => void; event: TimingEvent }) {
  const tabs: [Tab, string][] = [
    ['mine', 'Моё время'],
    ['team', 'Вся команда'],
  ];
  return (
    <div
      role="tablist"
      aria-label="Режим сетки"
      className="flex self-start rounded-control bg-card-sunk p-1"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const next = tab === 'mine' ? 'team' : 'mine';
        setTab(next);
        document.getElementById(`tab-${next}`)?.focus();
      }}
    >
      {tabs.map(([id, label]) => (
        <button
          key={id}
          id={`tab-${id}`}
          type="button"
          role="tab"
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          tabIndex={tab === id ? 0 : -1}
          onClick={() => setTab(id)}
          className={`ui-press ui-focus flex h-9 items-center gap-2 rounded-cell px-4 text-small font-bold ${
            tab === id ? 'bg-card text-ink' : 'text-ink-muted'
          }`}
        >
          {label}
          {id === 'team' && (
            <span className="font-mono text-caption font-normal tabular">
              {event.respondedCount}/{event.participantCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function MyAvailability({
  event,
  onSaved,
  heat,
}: {
  event: TimingEvent;
  onSaved: () => void;
  heat: Heatmap | null;
}) {
  const [showTeam, setShowTeam] = useState(false);
  const myId = event.participants?.find((p) => p.isMe)?.id;
  const others = event.participantCount - 1;
  const { selected, loadState, reload, setSelection, saveState, saveError, retry } =
    useAvailability(event.code, true, onSaved);
  if (loadState === 'loading') {
    return (
      <div
        className="h-48 animate-pulse rounded-control bg-card-sunk"
        role="status"
        aria-label="Загрузка отметок"
      />
    );
  }
  if (loadState === 'error') {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-control bg-danger-soft px-4 py-3 text-small text-danger"
        role="alert"
      >
        Не удалось загрузить ваши отметки.
        <Button variant="secondary" onClick={reload}>
          Повторить
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {others > 0 && (
        <label className="flex cursor-pointer items-center gap-3 self-start text-small">
          <button
            type="button"
            role="switch"
            aria-checked={showTeam}
            onClick={() => setShowTeam((v) => !v)}
            className="ui-switch ui-focus"
          />
          Показать команду на фоне
        </label>
      )}
      <AvailabilityGrid
        event={event}
        selected={selected}
        setSelection={setSelection}
        saveState={saveState}
        saveError={saveError}
        onRetry={retry}
        hint={
          showTeam && heat
            ? {
                count: (start) => (heat.free.get(start) ?? []).filter((id) => id !== myId).length,
                total: others,
              }
            : null
        }
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-b border-rule py-2">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-small font-bold">{value}</dd>
    </div>
  );
}

/** Ссылка-приглашение с копированием. */
function Invite({ code, highlight }: { code: string; highlight: boolean }) {
  const url = inviteUrl(code);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Буфер обмена недоступен (не https, запрет браузера) — выделяем ссылку для ручного копирования
      setCopyFailed(true);
      (document.getElementById('invite-url') as HTMLInputElement | null)?.select();
    }
  }

  return (
    <section aria-labelledby="invite-title" className="flex flex-col gap-2">
      <h2 id="invite-title" className="font-display text-h2">
        {highlight ? 'Мероприятие создано — разошлите ссылку' : 'Ссылка-приглашение'}
      </h2>
      <div className="paper flex items-center gap-2 rounded-control p-2">
        <input
          id="invite-url"
          readOnly
          value={url}
          aria-label="Ссылка-приглашение"
          onFocus={(e) => e.currentTarget.select()}
          className="ui-field h-11 min-w-0 flex-1 rounded-cell bg-card-sunk px-3 font-mono text-caption tabular text-ink"
        />
        <Button onClick={copy} aria-live="polite">
          <span className="ui-swap" data-swapped={copied ? '' : undefined}>
            <span>Копировать</span>
            <span>Скопировано</span>
          </span>
        </Button>
      </div>
      {copyFailed && (
        <p className="text-small text-on-canvas-muted">
          Браузер не дал скопировать автоматически — ссылка выделена, скопируйте её вручную.
        </p>
      )}
    </section>
  );
}

/** Участники — стеллаж карточек. */
function People({
  event,
  spotlight,
  onPick,
}: {
  event: TimingEvent;
  spotlight: number | null;
  onPick: (id: number) => void;
}) {
  const people = event.participants ?? [];
  return (
    <section aria-labelledby="people-title" className="flex flex-col gap-2">
      <h2 id="people-title" className="flex items-baseline justify-between font-display text-h2">
        Участники
        <span className="font-mono text-caption font-normal tabular text-on-canvas-muted">
          отметили {event.respondedCount} из {event.participantCount}
        </span>
      </h2>
      <ul className="grid grid-cols-2 gap-2 rounded-card bg-canvas-deep p-2">
        {people.map((p) => (
          <li key={p.id} className="flex">
            <button
              type="button"
              aria-pressed={spotlight === p.id}
              onClick={() => onPick(p.id)}
              aria-label={`${p.name}: показать время на общей карте`}
              className={`paper ui-press ui-press--surface ui-focus flex w-full flex-col gap-1 rounded-control p-2 text-left ${
                spotlight === p.id
                  ? 'ring-2 ring-on-canvas ring-offset-2 ring-offset-canvas-deep'
                  : ''
              }`}
            >
              <span className="truncate text-small font-bold" title={p.name}>
                {p.name}
                {p.isMe && <span className="font-normal text-ink-muted"> (вы)</span>}
              </span>
              <span className="text-caption text-ink-muted">
                {p.isOrganizer ? 'организатор' : 'участник'},{' '}
                {p.responded ? 'время отмечено' : 'ждём отметку'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Не участник: войти или присоединиться. */
function JoinPanel({
  event,
  onJoined,
}: {
  event: TimingEvent;
  onJoined: (e: TimingEvent) => void;
}) {
  const { user } = useAuth();
  const from = `/e/${event.code}`;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setPending(true);
    setError(null);
    try {
      onJoined(await eventsApi.join(event.code));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось присоединиться');
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="join-title" className="flex flex-col gap-4">
      <h2 id="join-title" className="font-display text-h2">
        {event.participantCount > 1
          ? `${event.organizer.name} и ещё ${event.participantCount - 1} зовут вас`
          : `${event.organizer.name} зовёт вас`}
      </h2>
      <FormError message={error} />
      {event.status === 'closed' ? (
        <p className="text-on-canvas-muted">Время уже назначено, присоединиться нельзя.</p>
      ) : user ? (
        <Button
          variant="cta"
          size="lg"
          pending={pending}
          pendingLabel="Присоединяем"
          onClick={join}
          className="self-start"
        >
          Присоединиться
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-on-canvas-muted">
            Чтобы отметить своё время, войдите или создайте аккаунт.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink to="/register" state={{ from }} variant="cta" size="lg">
              Создать аккаунт
            </ButtonLink>
            <Link
              to="/login"
              state={{ from }}
              className="ui-dim ui-focus rounded-control font-bold underline decoration-rail underline-offset-4"
            >
              Войти
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function EventSkeleton() {
  return (
    <div
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12"
      role="status"
      aria-label="Загрузка мероприятия"
    >
      <div className="paper flex animate-pulse flex-col gap-4 rounded-card px-4 pt-10 pb-6 sm:px-8">
        <span className="h-3 w-24 rounded-cell bg-card-sunk" />
        <span className="h-9 w-2/3 rounded-cell bg-card-sunk" />
        <span className="h-20 rounded-cell bg-card-sunk" />
      </div>
      <div className="flex animate-pulse flex-col gap-2">
        <span className="h-6 w-1/2 rounded-cell bg-canvas-deep" />
        <span className="h-14 rounded-control bg-canvas-deep" />
      </div>
    </div>
  );
}
