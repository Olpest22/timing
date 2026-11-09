import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md p-1 bg-brand-600" aria-hidden>
              <span className="rounded-[2px] bg-brand-100" />
              <span className="rounded-[2px] bg-brand-300" />
              <span className="rounded-[2px] bg-brand-300" />
              <span className="rounded-[2px] bg-white" />
            </span>
            Тайминг
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
