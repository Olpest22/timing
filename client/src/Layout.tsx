import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from './auth/context';
import { Logo } from './components/Logo';
import { ThemePicker } from './components/ThemePicker';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `ui-dim ui-focus rounded-control px-1.5 py-1 text-small font-bold hover:text-on-canvas sm:px-2 ${
    isActive ? 'text-on-canvas' : 'text-on-canvas-muted'
  }`;

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // После входа из шапки возвращаемся на текущую страницу (например, на мероприятие)
  const onAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const returnState = onAuthPage
    ? location.state
    : location.pathname === '/'
      ? undefined
      : { from: location.pathname };

  return (
    <div className="flex min-h-screen flex-col" data-ui-edge>
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="ui-dim ui-focus rounded-control py-2"
          aria-label="Тайминг, на главную"
        >
          <Logo />
        </Link>

        {!loading && (
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Основная навигация">
            <ThemePicker />
            {user ? (
              <>
                <NavLink to="/dashboard" className={navLink}>
                  Мероприятия
                </NavLink>
                <span className="hidden px-2 text-small text-on-canvas-muted sm:inline">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Гость без email и пароля не сможет войти обратно — спрашиваем
                    if (
                      user.isGuest &&
                      !window.confirm(
                        'Вы вошли без регистрации. После выхода вернуться к своим отметкам не получится. Выйти?',
                      )
                    )
                      return;
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
                <NavLink to="/login" state={returnState} className={navLink}>
                  Войти
                </NavLink>
                <NavLink to="/register" state={returnState} className={navLink}>
                  Регистрация
                </NavLink>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
