import type { ReactNode } from 'react';

export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 pt-4 sm:pt-8">
      <div className="rounded-card bg-card p-6 sm:p-8">
        <h1 className="font-display text-h1">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
      <p className="text-center text-small text-ink-muted">{footer}</p>
    </div>
  );
}
