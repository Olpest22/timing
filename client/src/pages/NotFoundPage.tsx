import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">
        На главную
      </Link>
    </div>
  );
}
