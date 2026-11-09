import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/context';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { Button, ButtonLink } from '../components/Button';
import { Field, FormError } from '../components/form';
import { buttonClass } from '../components/buttonClass';
import { ApiError } from '../lib/api';
import { useAvailability } from '../lib/useAvailability';
import { useHeatmap } from '../lib/useHeatmap';
import { useEventLive } from '../lib/useEventLive';
import { browserTimeZone, tzLabel, viewerShiftMinutes } from '../lib/tz';
import {
  daysBetween,
  eventsApi,
  formatDateRange,
  formatDuration,
  inviteUrl,
  deadlineLeft,
  finalSlot,
  hhmm,
  minutesOf,
  formatSlotRange,
  formatWeekday,
  formatDayShort,
  planApi,
  plural,
  type Heatmap,
  type Suggestion,
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

  // Применяется только ответ на последний запрос: иначе старый ответ (например, до
  // «присоединиться») мог бы затереть свежее состояние
  const seq = useRef(0);
  const fetchEvent = useCallback(() => {
    const mySeq = ++seq.current;
    return eventsApi
      .get(code)
      .then((event) => mySeq === seq.current && setLoad({ state: 'ok', event }))
      .catch((e) => {
        if (mySeq !== seq.current) return;
        setLoad({
          state: 'error',
          status: e instanceof ApiError ? e.status : 0,
          message: e instanceof ApiError ? e.message : 'Сервер недоступен',
        });
      });
  }, [code]);

  const loaded = load.state === 'ok' ? load.event : null;
  const { heat, refetch: refetchHeat } = useHeatmap(code, !!loaded?.me);
  const [tab, setTab] = useState<Tab | null>(null);
  // Вкладка выбирается один раз при загрузке: ещё не отметился — «Моё время», иначе —
  // общая карта. Потом сама не переключается (иначе первое сохранение уводило бы со своей сетки).
  if (tab === null && loaded) setTab(loaded.me?.responded ? 'team' : 'mine');
  const [spotlight, setSpotlight] = useState<number | null>(null);

  // После своего сохранения обновляем счётчики участников и общую карту
  const isMember = !!loaded?.me;
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const refetchSuggestions = useCallback(
    () =>
      planApi
        .suggestions(code)
        .then(setSuggestions)
        .catch(() => setSuggestions([])),
    [code],
  );
  useEffect(() => {
    if (isMember) refetchSuggestions();
  }, [isMember, refetchSuggestions]);

  const updateEvent = useCallback((e: TimingEvent) => {
    seq.current++; // запросы в пути устарели
    setLoad({ state: 'ok', event: e });
  }, []);

  // Живые обновления: кто-то отметился, назначил время, изменил или удалил мероприятие
  useEventLive(code, isMember, (changes) => {
    if (changes.has('deleted')) {
      seq.current++;
      setLoad({ state: 'error', status: 410, message: 'Организатор удалил мероприятие.' });
      return;
    }
    fetchEvent();
    refetchHeat();
    refetchSuggestions();
  });

  const onSaved = useCallback(() => {
    refetchSuggestions();
    fetchEvent();
    refetchHeat();
  }, [fetchEvent, refetchHeat, refetchSuggestions]);

  // Ждём восстановления сессии: от неё зависит, видны ли участники
  useEffect(() => {
    if (!authLoading) fetchEvent();
  }, [authLoading, fetchEvent, user?.id]);

  if (load.state === 'loading') return <EventSkeleton />;
  if (load.state === 'error') {
    return (
      <div className="flex flex-col items-start gap-4 pt-8">
        <h1 className="font-display text-h1">
          {load.status === 404
            ? 'Мероприятие не найдено'
            : load.status === 410
              ? 'Мероприятие удалено'
              : 'Не удалось загрузить'}
        </h1>
        <p className="text-on-canvas-muted">
          {load.status === 404 ? 'Проверьте ссылку: возможно, в ней опечатка.' : load.message}
        </p>
        {load.status === 404 || load.status === 410 ? (
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
        suggestions={suggestions}
        onEventChange={updateEvent}
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
              onToggleRequired={async (id, isRequired) => {
                updateEvent(await planApi.setRequired(event.code, id, isRequired));
                refetchSuggestions();
              }}
            />
          </>
        ) : (
          <JoinPanel event={event} onJoined={updateEvent} />
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
  suggestions,
  onEventChange,
}: {
  event: TimingEvent;
  onSaved: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  heat: Heatmap | null;
  spotlight: number | null;
  suggestions: Suggestion[] | null;
  onEventChange: (e: TimingEvent) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = suggestions?.find((s) => s.start === picked) ?? suggestions?.[0] ?? null;
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
          <dd
            id="event-title"
            className="flex items-start justify-between gap-4 font-display text-h1"
          >
            {event.title}
            {event.me?.isOrganizer && (
              <Link
                to={`/e/${event.code}/edit`}
                className="ui-dim ui-focus mt-2 flex-none rounded-control font-sans text-small font-bold text-ink-muted underline underline-offset-4"
              >
                Изменить
              </Link>
            )}
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
        <Row label="Часовой пояс" value={tzLabel(event.timezone)} />
        {event.deadline && event.status === 'open' && (
          <Row
            label="Отметить до"
            value={`${formatDateRange(event.deadline, event.deadline)}, ${deadlineLeft(event.deadline)}`}
          />
        )}
      </dl>
      <TimeZoneNotice event={event} />

      {event.description && (
        <p className="mt-4 whitespace-pre-line text-body">{event.description}</p>
      )}

      <div className="mt-6">
        {event.status === 'closed' && event.finalStart ? (
          <FinalPanel
            event={event}
            heat={heat}
            spotlight={spotlight}
            onEventChange={onEventChange}
          />
        ) : event.me ? (
          <div className="flex flex-col gap-4">
            <Tabs tab={tab} setTab={setTab} event={event} />
            {/* Обе панели остаются смонтированными: несохранённые отметки не теряются */}
            <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" hidden={tab !== 'mine'}>
              <MyAvailability event={event} onSaved={onSaved} heat={heat} />
            </div>
            <div role="tabpanel" id="panel-team" aria-labelledby="tab-team" hidden={tab !== 'team'}>
              <BestSlots
                event={event}
                suggestions={suggestions}
                chosen={chosen}
                onPick={setPicked}
                onEventChange={onEventChange}
              />
              {heat ? (
                <HeatmapGrid
                  event={event}
                  heat={heat}
                  participants={event.participants ?? []}
                  spotlight={spotlight}
                  frame={spotlight ? null : chosen?.start}
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

/** У зрителя другой пояс — показываем, как перевести время табеля */
function TimeZoneNotice({ event }: { event: TimingEvent }) {
  const shift = viewerShiftMinutes(event.timezone, event.dateFrom);
  if (shift === 0) return null;
  const example = minutesOf(event.dayStart);
  const mine = (((example + shift) % 1440) + 1440) % 1440;
  const h = Math.abs(shift) / 60;
  return (
    <p className="mt-4 rounded-control bg-card-sunk px-4 py-3 text-small">
      У вас другой часовой пояс ({tzLabel(browserTimeZone())}): время в табеле указано по поясу
      мероприятия. {event.dayStart} в табеле — это <b>{hhmm(mine)}</b> у вас (
      {shift > 0 ? '+' : '−'}
      {Number.isInteger(h) ? h : h.toFixed(1)} ч).
    </p>
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
/** Лучшее время: до трёх непересекающихся вариантов; организатор назначает. */
function BestSlots({
  event,
  suggestions,
  chosen,
  onPick,
  onEventChange,
}: {
  event: TimingEvent;
  suggestions: Suggestion[] | null;
  chosen: Suggestion | null;
  onPick: (start: string) => void;
  onEventChange: (e: TimingEvent) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = event.participants ?? [];
  const name = (id: number) => people.find((p) => p.id === id)?.name ?? '—';
  const hasRequired = people.some((p) => p.isRequired);

  async function finalize() {
    if (!chosen) return;
    setPending(true);
    setError(null);
    try {
      onEventChange(await planApi.finalize(event.code, chosen.start));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось назначить время');
    } finally {
      setPending(false);
    }
  }

  if (suggestions === null) {
    return (
      <div
        className="mb-4 h-24 animate-pulse rounded-control bg-card-sunk"
        role="status"
        aria-label="Подбираем время"
      />
    );
  }
  return (
    <section aria-labelledby="best-title" className="mb-6 flex flex-col gap-2">
      <h3 id="best-title" className="font-display text-h2">
        Лучшее время
      </h3>
      {suggestions.length === 0 ? (
        <p className="rounded-control bg-card-sunk px-4 py-3 text-small">
          {hasRequired
            ? `Нет окна на ${formatDuration(event.durationMin)}, где свободны все обязательные участники.`
            : `Пока ни у кого нет свободного окна на ${formatDuration(event.durationMin)} подряд.`}
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-3">
          {suggestions.map((s) => {
            const [day, time] = s.start.split('T');
            const on = chosen?.start === s.start;
            return (
              <li key={s.start} className="flex">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(s.start)}
                  className={`ui-press ui-press--surface ui-focus flex w-full flex-col gap-1 rounded-control border-2 p-3 text-left ${
                    on ? 'border-ink bg-card' : 'border-transparent bg-card-sunk'
                  }`}
                >
                  <span className="font-mono text-small font-semibold tabular text-signal">
                    {formatWeekday(day)}, {formatDayShort(day)} {time}–{s.end.slice(11)}
                  </span>
                  <span className="text-small font-bold">
                    свободны {s.free.length} из {people.length}
                  </span>
                  {s.maybe.length > 0 && (
                    <span className="text-caption text-ink-muted">
                      если очень надо: {s.maybe.map(name).join(', ')}
                    </span>
                  )}
                  {s.busy.length > 0 && (
                    <span className="text-caption text-ink-muted">
                      не могут: {s.busy.map(name).join(', ')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <FormError message={error} />
      {chosen &&
        (event.me?.isOrganizer ? (
          <Button
            pending={pending}
            pendingLabel="Назначаем"
            onClick={finalize}
            className="self-start"
          >
            Назначить: {formatSlotRange(chosen.start, event.durationMin)}
          </Button>
        ) : (
          <p className="text-caption text-ink-muted">
            Время назначает организатор: {event.organizer.name}.
          </p>
        ))}
    </section>
  );
}

/** Время назначено: оттиск, карта с рамкой, организатору — вернуть к выбору. */
function FinalPanel({
  event,
  heat,
  spotlight,
  onEventChange,
}: {
  event: TimingEvent;
  heat: Heatmap | null;
  spotlight: number | null;
  onEventChange: (e: TimingEvent) => void;
}) {
  const start = finalSlot(event)!;
  const [day, time] = start.split('T');
  const [pending, setPending] = useState(false);

  async function reopen() {
    setPending(true);
    try {
      onEventChange(await planApi.reopen(event.code));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-control bg-card-sunk px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <span className="text-caption text-ink-muted">Время назначено</span>
          <span className="stamp-hit font-mono text-stamp-sm font-semibold tabular text-signal sm:text-stamp">
            {formatWeekday(day).toUpperCase()} {time}–
            {formatSlotRange(start, event.durationMin).slice(-5)}
          </span>
          <span className="text-small font-bold">{formatSlotRange(start, event.durationMin)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href={eventsApi.icsUrl(event.code)} download className={buttonClass('primary', 'md')}>
            Добавить в календарь
          </a>
          {event.me?.isOrganizer && (
            <Button
              variant="secondary"
              pending={pending}
              pendingLabel="Возвращаем"
              onClick={reopen}
            >
              Вернуть к выбору
            </Button>
          )}
        </div>
      </div>
      {event.me && heat && (
        <HeatmapGrid
          event={event}
          heat={heat}
          participants={event.participants ?? []}
          spotlight={spotlight}
          frame={spotlight ? null : start}
        />
      )}
    </div>
  );
}

function People({
  event,
  spotlight,
  onPick,
  onToggleRequired,
}: {
  event: TimingEvent;
  spotlight: number | null;
  onPick: (id: number) => void;
  onToggleRequired: (id: number, isRequired: boolean) => Promise<void>;
}) {
  const people = event.participants ?? [];
  const canEdit = !!event.me?.isOrganizer && event.status === 'open';
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
          <li key={p.id} className="relative flex">
            <button
              type="button"
              aria-pressed={spotlight === p.id}
              onClick={() => onPick(p.id)}
              aria-label={`${p.name}: показать время на общей карте`}
              className={`paper ui-press ui-press--surface ui-focus flex w-full flex-col gap-1 rounded-control p-2 text-left ${
                canEdit ? 'pr-8' : ''
              } ${
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
                {p.isOrganizer ? 'организатор' : 'участник'}, {p.isRequired && 'обязательный, '}
                {p.responded ? 'время отмечено' : 'ждём отметку'}
              </span>
            </button>
            {canEdit && (
              // ui-press задаёт position: relative, поэтому позиционирует обёртка
              <span className="absolute top-1 right-1">
                <button
                  type="button"
                  aria-pressed={p.isRequired}
                  aria-label={`${p.name}: ${p.isRequired ? 'сделать необязательным' : 'сделать обязательным'}`}
                  title={p.isRequired ? 'Обязательный участник' : 'Сделать обязательным'}
                  onClick={() => onToggleRequired(p.id, !p.isRequired)}
                  className="ui-press ui-focus grid size-7 place-items-center rounded-cell text-ink-muted"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className={`size-4 ${p.isRequired ? 'text-signal' : ''}`}
                    aria-hidden
                  >
                    <path
                      d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
                      fill={p.isRequired ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </span>
            )}
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
  const { user, loginAsGuest } = useAuth();
  const from = `/e/${event.code}`;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  async function joinAsGuest(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await loginAsGuest(name);
      onJoined(await eventsApi.join(event.code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setPending(false);
    }
  }

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
        <div className="flex flex-col gap-4">
          <form onSubmit={joinAsGuest} className="paper flex flex-col gap-4 rounded-card p-4">
            <Field
              label="Как вас зовут"
              name="guestName"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="Без регистрации: к своим отметкам вы вернётесь только в этом браузере."
            />
            <Button type="submit" pending={pending} pendingLabel="Входим" className="self-start">
              Отметить своё время
            </Button>
          </form>
          <p className="text-small text-on-canvas-muted">
            Есть аккаунт?{' '}
            <Link
              to="/login"
              state={{ from }}
              className="ui-link ui-focus font-bold text-on-canvas"
            >
              Войти
            </Link>{' '}
            или{' '}
            <Link
              to="/register"
              state={{ from }}
              className="ui-link ui-focus font-bold text-on-canvas"
            >
              создать аккаунт
            </Link>
          </p>
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
