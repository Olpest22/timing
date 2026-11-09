import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from './auth/context';
import { buttonClass } from './components/buttonClass';
import { Logo } from './components/Logo';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `ui-dim ui-focus rounded-control px-2 py-1 text-small font-bold hover:text-ink ${isActive ? 'text-ink' : 'text-ink-muted'}`;

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col" data-ui-edge>
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="ui-dim ui-focus rounded-control py-2"
          aria-label="Тайминг, на главную"
        >
          <Logo />
        </Link>

        {!loading && (
          <nav className="flex items-center gap-2" aria-label="Основная навигация">
            {user ? (
              <>
                <NavLink to="/dashboard" className={navLink}>
                  Мероприятия
                </NavLink>
                <span className="hidden px-2 text-small text-ink-muted sm:inline">{user.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className={navLink({ isActive: false })}
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navLink}>
                  Войти
                </NavLink>
                <Link to="/register" className={buttonClass('primary', 'md')}>
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
