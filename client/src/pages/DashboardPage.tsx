import { useAuth } from '../auth/context';
import { Button } from '../components/form';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Мои мероприятия</h1>
          <p className="mt-1 text-stone-600">Привет, {user?.name}!</p>
        </div>
        <Button disabled title="Появится на этапе 2">
          + Создать мероприятие
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="text-lg font-medium">Мероприятий пока нет</p>
        <p className="mt-1 text-stone-600">
          Создайте первое мероприятие и пригласите команду по ссылке.
        </p>
      </div>
    </div>
  );
}
