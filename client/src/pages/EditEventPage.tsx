import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Field, FormError, TextArea } from '../components/form';
import { ApiError } from '../lib/api';
import { eventsApi, formatDateRange, plural, type TimingEvent } from '../lib/events';

/** Организатор меняет название, описание и срок; удаляет мероприятие. */
export function EditEventPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TimingEvent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', deadline: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    eventsApi
      .get(code)
      .then((e) => {
        setEvent(e);
        setForm({ title: e.title, description: e.description ?? '', deadline: e.deadline ?? '' });
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Сервер недоступен'));
  }, [code]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors(({ [key]: _fixed, ...rest }) => rest);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await eventsApi.update(code, {
        title: form.title,
        description: form.description.trim() || null,
        deadline: form.deadline || null,
      });
      navigate(`/e/${code}`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFieldErrors(err.fields);
      else setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await eventsApi.remove(code);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      dialog.current?.close();
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить');
      setDeleting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-4 pt-8">
        <h1 className="font-display text-h1">Не удалось загрузить</h1>
        <p className="text-on-canvas-muted">{loadError}</p>
      </div>
    );
  }
  if (!event)
    return <div className="mx-auto h-96 max-w-2xl animate-pulse rounded-card bg-canvas-deep" />;
  if (!event.me?.isOrganizer) {
    return (
      <div className="flex flex-col items-start gap-4 pt-8">
        <h1 className="font-display text-h1">Изменять может только организатор</h1>
        <Link to={`/e/${code}`} className="ui-link ui-focus font-bold">
          К мероприятию
        </Link>
      </div>
    );
  }

  const others = event.participantCount - 1;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/e/${code}`}
          className="ui-dim ui-focus self-start rounded-control text-small text-on-canvas-muted"
        >
          ← {event.title}
        </Link>
        <h1 className="font-display text-h1">Изменить мероприятие</h1>
      </div>

      <form
        onSubmit={save}
        noValidate
        className="paper flex flex-col gap-6 rounded-card px-4 py-6 sm:px-8 sm:py-8"
      >
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
          maxLength={1000}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          error={fieldErrors.description}
        />
        <Field
          label="Отметить до"
          name="deadline"
          type="date"
          max={event.dateTo}
          value={form.deadline}
          onChange={(e) => set('deadline', e.target.value)}
          error={fieldErrors.deadline}
          hint="Оставьте пустым, если срока нет."
        />
        <p className="rounded-control bg-card-sunk px-4 py-3 text-small">
          Даты ({formatDateRange(event.dateFrom, event.dateTo)}), часы и шаг сетки после создания не
          меняются: иначе пропали бы отметки участников.
        </p>
        <Button type="submit" pending={saving} pendingLabel="Сохраняем" className="self-start">
          Сохранить
        </Button>
      </form>

      <section
        aria-labelledby="danger-title"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="danger-title" className="font-display text-h2">
            Удалить мероприятие
          </h2>
          <p className="text-small text-on-canvas-muted">
            Удалятся ссылка и все отметки. Отменить нельзя.
          </p>
        </div>
        <Button variant="danger" onClick={() => dialog.current?.showModal()}>
          Удалить
        </Button>
      </section>

      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        className="paper ui-pop-in m-auto max-w-sm rounded-card p-6 backdrop:bg-ink/60"
      >
        <h2 id="confirm-title" className="font-display text-h2">
          Удалить «{event.title}»?
        </h2>
        <p className="mt-2 text-small">
          {others > 0
            ? `Отметки ещё ${others} ${plural(others, ['участника', 'участников', 'участников'])} тоже удалятся. `
            : ''}
          Отменить это нельзя.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-4">
          <Button variant="secondary" onClick={() => dialog.current?.close()} autoFocus>
            Отмена
          </Button>
          <Button variant="danger" pending={deleting} pendingLabel="Удаляем" onClick={remove}>
            Удалить навсегда
          </Button>
        </div>
      </dialog>
    </div>
  );
}
