import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../components/Spinner';
import { useAuth } from './context';

/**
 * Пускает только авторизованных; остальных отправляет на /login и запоминает, куда они шли.
 * После нажатия «Выйти» отправляет на главную.
 */
export function RequireAuth() {
  const { user, loading, loggedOut } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user && loggedOut) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Страницы входа/регистрации: авторизованного уводим туда, куда он шёл, или в кабинет. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  if (loading) return <Spinner />;
  if (user) return <Navigate to={from ?? '/dashboard'} replace />;
  return <Outlet />;
}
