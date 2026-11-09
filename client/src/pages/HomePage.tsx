import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Health = { status: string; db: 'ok' | 'error'; time: string };

export function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Health>('/health')
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  const pending = !health && !error;

  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Найдите время, когда свободны все</h1>
        <p className="mt-4 text-lg text-stone-600">
          Создайте мероприятие, разошлите ссылку — участники закрасят свободные часы, а тепловая
          карта покажет лучший слот для всей команды.
        </p>
      </section>

      <section className="max-w-md rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Состояние системы</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <StatusRow label="Фронтенд" ok />
          <StatusRow label="API" ok={pending ? undefined : !!health} />
          <StatusRow label="База данных" ok={pending ? undefined : health?.db === 'ok'} />
        </dl>
        {error && <p className="mt-3 text-sm text-red-600">Ошибка: {error}</p>}
      </section>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok?: boolean }) {
  const text = ok === undefined ? 'проверка…' : ok ? 'работает' : 'недоступно';
  const color = ok === undefined ? 'bg-stone-300' : ok ? 'bg-brand-500' : 'bg-red-500';
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-600">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {text}
      </dd>
    </div>
  );
}
