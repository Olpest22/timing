import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from './auth/context';

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:text-stone-900'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span
              className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md bg-brand-600 p-1"
              aria-hidden
            >
              <span className="rounded-[2px] bg-brand-100" />
              <span className="rounded-[2px] bg-brand-300" />
              <span className="rounded-[2px] bg-brand-300" />
              <span className="rounded-[2px] bg-white" />
            </span>
            Тайминг
          </Link>

          {!loading && (
            <nav className="flex items-center gap-1">
              {user ? (
                <>
                  <NavLink to="/dashboard" className={navClass}>
                    Мероприятия
                  </NavLink>
                  <span className="hidden px-2 text-sm text-stone-500 sm:inline">{user.name}</span>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass}>
                    Войти
                  </NavLink>
                  <Link
                    to="/register"
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
