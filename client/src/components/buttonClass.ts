/**
 * Классы кнопки по DESIGN.md.
 * primary — фиолетовые чернила, на бумаге; paper — белая карточка, на тёмном стеллаже;
 * secondary — бумага с границей. Размеры md (44) и lg (48).
 */
export type Variant = 'primary' | 'paper' | 'secondary';
export type Size = 'md' | 'lg';

const base =
  'ui-press ui-focus inline-flex items-center justify-center gap-2 rounded-control font-bold whitespace-nowrap select-none';
const variants: Record<Variant, string> = {
  primary: 'ui-press--on-dark bg-signal text-on-signal',
  paper: 'bg-card text-ink',
  secondary: 'bg-card text-ink border border-edge',
};
const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-small',
  lg: 'h-12 px-6 text-body',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}
