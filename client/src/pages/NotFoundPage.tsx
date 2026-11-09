import { ButtonLink } from '../components/Button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4 pt-8">
      <h1 className="font-display text-h1">Такой страницы нет</h1>
      <ButtonLink to="/" variant="cta">
        На главную
      </ButtonLink>
    </div>
  );
}
