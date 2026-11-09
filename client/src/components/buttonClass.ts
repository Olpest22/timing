/**
 * Классы кнопки по DESIGN.md.
 * primary — чернила палитры, на бумаге; cta — основная кнопка на стеллаже (в тёмных
 * палитрах белая «бумажная», в светлой — чернильная);
 * secondary — бумага с границей. Размеры md (44) и lg (48).
 */
export type Variant = 'primary' | 'cta' | 'secondary' | 'danger';
export type Size = 'md' | 'lg';

const base =
  'ui-press ui-focus inline-flex items-center justify-center gap-2 rounded-control font-bold whitespace-nowrap select-none';
const variants: Record<Variant, string> = {
  primary: 'ui-press--on-dark bg-signal text-on-signal',
  cta: 'bg-cta text-on-cta',
  secondary: 'bg-card text-ink border border-edge',
  /** Необратимое действие (удалить): красная лента, текст бумаги */
  danger: 'ui-press--on-dark bg-danger text-on-signal',
};
const sizes: Record<Size, string> = {
  md: 'h-11 px-4 text-small',
  lg: 'h-12 px-6 text-body',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}
