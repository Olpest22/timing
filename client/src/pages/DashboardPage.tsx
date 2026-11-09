import { Button } from '../components/Button';

const SLOTS = ['Ждут ответов', 'Время назначено', 'Прошли'];

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1">Мероприятия</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {SLOTS.map((title, i) => (
          <section
            key={title}
            aria-labelledby={`slot-${i}`}
            className="flex min-h-40 flex-col gap-4 rounded-card bg-canvas-deep p-4"
          >
            <h2
              id={`slot-${i}`}
              className="flex items-baseline justify-between text-small font-bold"
            >
              {title}
              <span className="font-mono text-caption tabular text-on-canvas-muted">0</span>
            </h2>
            {i === 0 && (
              <div className="paper flex flex-col items-start gap-4 rounded-control p-4">
                <p className="text-small">
                  Создайте мероприятие и разошлите ссылку: карточки будут появляться здесь, пока
                  команда отмечает время.
                </p>
                <div className="flex flex-col gap-1">
                  <Button disabled aria-describedby="create-soon">
                    Создать мероприятие
                  </Button>
                  <p id="create-soon" className="text-caption text-ink-muted">
                    Создание мероприятий появится на этапе 2.
                  </p>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
