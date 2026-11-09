import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type Common = {
  label: string;
  /** Ограничение, которое нужно знать до ввода (не пересказ подписи) */
  hint?: string;
  error?: string;
};

const control = (error?: string) =>
  `ui-field w-full rounded-control border bg-card px-3 text-body text-ink placeholder:text-ink-muted ${
    error ? 'border-danger' : 'border-edge'
  }`;

/** Подпись, подсказка и ошибка вокруг любого контрола; новая ошибка — один «вздрог». */
function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: Common & {
  id: string;
  children: (aria: { describedBy?: string; ref: (el: HTMLElement | null) => void }) => ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint && !error && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (error && el) globalThis.BetterUI?.shake(el);
    // Вздрагиваем только при новой ошибке, не при смене узла
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-bold">
        {label}
      </label>
      {children({ describedBy, ref: setEl })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-small text-danger">
          <ErrorIcon />
          {error}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? props.name!;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      {({ describedBy, ref }) => (
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`h-11 ${control(error)}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? props.name!;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      {({ describedBy, ref }) => (
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          rows={3}
          className={`min-h-24 py-2 ${control(error)}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id ?? props.name!;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      {({ describedBy, ref }) => (
        <select
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`h-11 ${control(error)}`}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-small text-danger"
    >
      <ErrorIcon className="mt-0.5" />
      {message}
    </div>
  );
}

function ErrorIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 flex-none ${className}`} aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.5v4.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="1" fill="white" />
    </svg>
  );
}
