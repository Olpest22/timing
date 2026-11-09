import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { GuestOnly, RequireAuth } from './auth/guards';
import './index.css';
import './lib/interaction-kit.js';
import { Layout } from './Layout';
import { DashboardPage } from './pages/DashboardPage';
import { EventPage } from './pages/EventPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NewEventPage } from './pages/NewEventPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ThemeProvider } from './theme/ThemeProvider';
import { RegisterPage } from './pages/RegisterPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/e/:code', element: <EventPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/events/new', element: <NewEventPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

// Отклик на нажатия для всех .ui-press / .ui-dim (делегирование событий, один раз)
globalThis.BetterUI.init(document);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
