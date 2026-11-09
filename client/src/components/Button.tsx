import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonClass, type Size, type Variant } from './buttonClass';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Асинхронное действие идёт: ширина сохраняется, повторные нажатия игнорируются */
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  pending = false,
  pendingLabel = 'Подождите',
  className = '',
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (pending) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      <span className="ui-btn-state" data-state={pending ? 'pending' : undefined}>
        <span className="ui-state-label inline-flex items-center gap-2">{children}</span>
        <span className="ui-state-pending inline-flex items-center gap-2" aria-hidden={!pending}>
          <span className="ui-spinner" />
          {pendingLabel}
        </span>
      </span>
    </button>
  );
}

type ButtonLinkProps = LinkProps & { variant?: Variant; size?: Size };

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
