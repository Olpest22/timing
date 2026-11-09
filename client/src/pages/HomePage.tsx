import { Link } from 'react-router';
import { useAuth } from '../auth/context';

export function HomePage() {
  const { user } = useAuth();

  return (
    <section className="max-w-2xl py-6">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Найдите время, когда свободны все
      </h1>
      <p className="mt-4 text-lg text-stone-600">
        Создайте мероприятие, разошлите ссылку — участники закрасят свободные часы, а тепловая карта
        покажет лучший слот для всей команды.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {user ? (
          <Link
            to="/dashboard"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Мои мероприятия
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
            >
              Начать бесплатно
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium hover:bg-stone-100"
            >
              Войти
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
