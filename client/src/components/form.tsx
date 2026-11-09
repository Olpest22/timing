import { useEffect, useRef, type InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Ограничение, которое нужно знать до ввода (не пересказ подписи) */
  hint?: string;
  error?: string;
};

export function Field({ label, hint, error, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const ref = useRef<HTMLInputElement>(null);

  // Новая ошибка: поле один раз вздрагивает, рядом остаётся текст причины
  useEffect(() => {
    if (error && ref.current) globalThis.BetterUI?.shake(ref.current);
  }, [error]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-small font-bold">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`ui-field h-11 w-full rounded-control border bg-card px-3 text-body text-ink placeholder:text-ink-muted ${
          error ? 'border-danger' : 'border-edge'
        }`}
        {...props}
      />
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
