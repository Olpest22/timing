import { Button } from '../components/Button';

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1">Мероприятия</h1>

      <section className="flex flex-col items-start gap-4 rounded-card bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-h2">Пока ни одного</h2>
          <p className="max-w-prose text-body text-ink-muted">
            Создайте мероприятие и разошлите ссылку: здесь появятся те, где ждут ответов, и те, где
            время уже назначено.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Button disabled aria-describedby="create-soon">
            Создать мероприятие
          </Button>
          <p id="create-soon" className="text-caption text-ink-muted">
            Создание мероприятий появится на этапе 2.
          </p>
        </div>
      </section>
    </div>
  );
}
