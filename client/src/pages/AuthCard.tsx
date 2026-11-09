import type { ReactNode } from 'react';

/** Форма входа и регистрации — карточка участника с вырезом для табельных часов. */
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
      <div className="paper relative rounded-card px-6 pt-10 pb-6 sm:px-8 sm:pb-8">
        <span
          aria-hidden
          data-ui-edge
          className="absolute top-0 left-1/2 h-4 w-12 -translate-x-1/2 rounded-b-pill bg-canvas"
        />
        <h1 className="border-b border-rule pb-2 font-display text-h1">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
      <p className="text-center text-small text-on-canvas-muted">{footer}</p>
    </div>
  );
}
