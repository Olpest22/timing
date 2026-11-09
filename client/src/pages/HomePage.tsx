import { Link } from 'react-router';
import { useAuth } from '../auth/context';
import { ButtonLink } from '../components/Button';
import { TimeCardDemo } from '../components/TimeCardDemo';

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
      <section className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-display-sm sm:text-display">
          Найдите время, когда свободны все
        </h1>
        <p className="max-w-xl text-body text-ink-muted">
          Разошлите команде ссылку: каждый отметит свободные часы, а «Тайминг» покажет, когда
          собраться.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {user ? (
            <ButtonLink to="/dashboard" size="lg">
              Мои мероприятия
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/register" size="lg">
                Создать аккаунт
              </ButtonLink>
              <Link
                to="/login"
                className="ui-dim ui-focus rounded-control text-body font-bold underline decoration-edge underline-offset-4 hover:decoration-ink"
              >
                У меня уже есть аккаунт
              </Link>
            </>
          )}
        </div>
      </section>

      <TimeCardDemo />
    </div>
  );
}
