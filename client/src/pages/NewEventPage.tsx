import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Field, FormError, Select, TextArea } from '../components/form';
import { ApiError } from '../lib/api';
import { allTimeZones, browserTimeZone, tzLabel } from '../lib/tz';
import {
  daysBetween,
  eventsApi,
  formatDateRange,
  formatDuration,
  hhmm,
  minutesOf,
  plural,
  type NewEventInput,
} from '../lib/events';

const STEPS = [15, 30, 60] as const;
type Step = (typeof STEPS)[number];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** По умолчанию — рабочая неделя: ближайший понедельник … пятница. */
function nextWorkWeek() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const fri = new Date(d);
  fri.setUTCDate(d.getUTCDate() + 4);
  return { from: iso(d), to: iso(fri) };
}

/** Варианты времени дня с шагом сетки */
const timesFor = (step: Step) => Array.from({ length: (24 * 60) / step }, (_, i) => hhmm(i * step));

export function NewEventPage() {
  const navigate = useNavigate();
  const [week] = useState(nextWorkWeek);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dateFrom: week.from,
    dateTo: week.to,
    dayStart: '10:00',
    dayEnd: '19:00',
    durationMin: 60,
    slotStepMin: 30 as Step,
    timezone: browserTimeZone(),
    deadline: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Исправленное поле больше не подсвечивается ошибкой (связанные поля — тоже)
  const clearErrors = (...keys: string[]) =>
    setFieldErrors((errs) => {
      if (!keys.some((k) => k in errs)) return errs;
      const next = { ...errs };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  const RELATED: Record<string, string[]> = {
    dateFrom: ['dateFrom', 'dateTo'],
    dateTo: ['dateFrom', 'dateTo'],
    dayStart: ['dayStart', 'dayEnd', 'durationMin'],
    dayEnd: ['dayStart', 'dayEnd', 'durationMin'],
    durationMin: ['durationMin'],
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearErrors(...(RELATED[key] ?? [key]));
  };

  const times = timesFor(form.slotStepMin);
  // Подписи поясов считаются один раз: их ~400, а Intl-форматирование не бесплатное
  const [zones] = useState(() => {
    const all = allTimeZones();
    return (all.includes(form.timezone) ? all : [form.timezone, ...all]).map(
      (z) => [z, tzLabel(z)] as const,
    );
  });
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const dayWindow = minutesOf(form.dayEnd) - minutesOf(form.dayStart);
  const durations = Array.from(
    { length: (12 * 60) / form.slotStepMin },
    (_, i) => (i + 1) * form.slotStepMin,
  ).filter((m) => m >= 30 || form.slotStepMin === 15);

  // Сводка: что увидят участники
  const days = form.dateTo >= form.dateFrom ? daysBetween(form.dateFrom, form.dateTo) : 0;
  const rows = dayWindow > 0 ? dayWindow / form.slotStepMin : 0;
  const summaryOk = days > 0 && rows > 0 && Number.isInteger(rows);

  function changeStep(step: Step) {
    clearErrors('slotStepMin', 'dayStart', 'dayEnd', 'durationMin');
    // Время, не попадающее на новый шаг, сдвигаем вниз к ближайшему
    const snap = (t: string) => hhmm(Math.floor(minutesOf(t) / step) * step);
    setForm((f) => ({
      ...f,
      slotStepMin: step,
      dayStart: snap(f.dayStart),
      dayEnd: snap(f.dayEnd),
      durationMin: Math.max(step, Math.round(f.durationMin / step) * step),
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const input: NewEventInput = {
        ...form,
        description: form.description.trim() || undefined,
        deadline: form.deadline || undefined,
      };
      const event = await eventsApi.create(input);
      navigate(`/e/${event.code}`, { state: { justCreated: true } });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) setFieldErrors(err.fields);
      else setError(err instanceof ApiError ? err.message : 'Не удалось создать мероприятие');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to="/dashboard"
          className="ui-dim ui-focus self-start rounded-control text-small text-on-canvas-muted"
        >
          ← Мероприятия
        </Link>
        <h1 className="font-display text-h1">Новое мероприятие</h1>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="paper relative flex flex-col gap-6 rounded-card px-4 pt-10 pb-6 sm:px-8 sm:pb-8"
      >
        <span
          aria-hidden
          data-ui-edge
          className="absolute top-0 left-1/2 h-4 w-12 -translate-x-1/2 rounded-b-pill bg-canvas"
        />
        <FormError message={error} />

        <Field
          label="Название"
          name="title"
          required
          maxLength={200}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={fieldErrors.title}
        />
        <TextArea
          label="Описание"
          name="description"
          hint="Необязательно. Увидят все, кто откроет ссылку."
          maxLength={1000}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          error={fieldErrors.description}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-h2">Когда можно собраться</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="С даты"
              name="dateFrom"
              type="date"
              required
              value={form.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              error={fieldErrors.dateFrom}
            />
            <Field
              label="По дату"
              name="dateTo"
              type="date"
              required
              min={form.dateFrom}
              value={form.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              error={fieldErrors.dateTo}
              hint="Не больше 31 дня."
            />
            <Select
              label="Часы дня: с"
              name="dayStart"
              value={form.dayStart}
              onChange={(e) => set('dayStart', e.target.value)}
              error={fieldErrors.dayStart}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select
              label="до"
              name="dayEnd"
              value={form.dayEnd}
              onChange={(e) => set('dayEnd', e.target.value)}
              error={fieldErrors.dayEnd}
            >
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select
              label="Часовой пояс"
              name="timezone"
              value={form.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              error={fieldErrors.timezone}
              hint="Сетку все увидят в этом поясе; у кого пояс другой, тому покажем разницу."
            >
              {zones.map(([z, label]) => (
                <option key={z} value={z}>
                  {label}
                </option>
              ))}
            </Select>
            <Field
              label="Отметить до"
              name="deadline"
              type="date"
              min={today}
              max={form.dateTo}
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              error={fieldErrors.deadline}
              hint="Необязательно. Покажем участникам, сколько дней осталось."
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-h2">Сетка</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Длительность встречи"
              name="durationMin"
              value={form.durationMin}
              onChange={(e) => set('durationMin', Number(e.target.value))}
              error={fieldErrors.durationMin}
            >
              {durations.map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-1">
              <span id="step-label" className="text-small font-bold">
                Шаг клетки
              </span>
              <div
                role="radiogroup"
                aria-labelledby="step-label"
                className="flex h-11 gap-1 rounded-control bg-card-sunk p-1"
              >
                {STEPS.map((s) => (
                  <label key={s} className="flex-1">
                    <input
                      type="radio"
                      name="slotStepMin"
                      value={s}
                      checked={form.slotStepMin === s}
                      onChange={() => changeStep(s)}
                      className="peer sr-only"
                    />
                    <span className="ui-press flex h-full cursor-pointer items-center justify-center rounded-cell text-small font-bold text-ink-muted peer-checked:bg-card peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-signal">
                      {s} мин
                    </span>
                  </label>
                ))}
              </div>
              {fieldErrors.slotStepMin && (
                <p className="text-small text-danger">{fieldErrors.slotStepMin}</p>
              )}
            </div>
          </div>
        </fieldset>

        <p className="rounded-control bg-card-sunk px-4 py-3 text-small" aria-live="polite">
          {summaryOk ? (
            <>
              Участники увидят {days} {plural(days, ['день', 'дня', 'дней'])} (
              {formatDateRange(form.dateFrom, form.dateTo)}) по {rows}{' '}
              {plural(rows, ['клетке', 'клетки', 'клеток'])} в день и отметят, когда свободны.
              Встреча займёт {formatDuration(form.durationMin)}.
            </>
          ) : (
            'Проверьте даты и часы: конец должен быть позже начала.'
          )}
        </p>

        <Button
          type="submit"
          pending={submitting}
          pendingLabel="Создаём"
          size="lg"
          className="self-start"
        >
          Создать мероприятие
        </Button>
      </form>
    </div>
  );
}
