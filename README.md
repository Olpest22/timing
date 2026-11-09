# Тайминг

Веб-приложение для планирования командных мероприятий. Участники отмечают своё свободное время на
сетке, а приложение строит тепловую карту пересечений и предлагает лучший слот.

## Стек

| Часть    | Технологии                                    |
| -------- | --------------------------------------------- |
| Фронтенд | React 19, TypeScript, Vite, Tailwind CSS 4, React Router; шрифты из npm (@fontsource) |
| Бэкенд   | Node.js 22, Express 5, TypeScript             |
| БД       | PostgreSQL 16, Prisma ORM                     |
| Запуск   | Docker Compose                                |

## Дизайн

Визуальная система описана в [DESIGN.md](DESIGN.md): направление «табель и табельные часы»,
три палитры на выбор пользователя (сохраняются в профиле),
шрифты (PT Sans Narrow, PT Sans, JetBrains Mono), цвета с измеренным контрастом, отступы,
радиусы, компоненты и анимация. Перед любой работой с интерфейсом прочитайте DESIGN.md и
берите значения оттуда; токены в коде — `client/src/index.css`.

## Структура

```
timing/
├── client/              # фронтенд (React + Vite)
│   └── src/
│       ├── components/  # Button, Field, TimeCardDemo, …
│       ├── pages/       # страницы
│       ├── styles/      # interaction kit (отклик на нажатия)
│       ├── lib/api.ts   # обёртка над fetch
│       └── index.css    # токены дизайна (Tailwind @theme)
├── server/              # бэкенд (Express)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── app.ts       # Express-приложение и маршруты
│       ├── db.ts        # Prisma Client
│       └── index.ts     # точка входа
└── docker-compose.yml
```

## Запуск через Docker

```bash
docker compose up --build
```

- Фронтенд: http://localhost:5173
- API: http://localhost:3000/api/health

Миграции БД применяются автоматически при старте контейнера `server`.

## Локальный запуск без Docker

Нужны Node.js 22+ и PostgreSQL 16 (или только БД из Docker: `docker compose up db`).

```bash
cd server
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

В другом терминале:

```bash
cd client
npm install
npm run dev
```

Фронтенд проксирует запросы `/api/*` на `http://localhost:3000`.

## API

Ответы — JSON. Ошибки приходят в виде `{ "error": "текст", "fields"?: { "поле": "текст" } }`.
Защищённые запросы требуют заголовок `Authorization: Bearer <token>`.

| Метод | Путь                 | Доступ    | Описание                                        |
| ----- | -------------------- | --------- | ----------------------------------------------- |
| GET   | `/api/health`        | все       | проверка API и БД                               |
| POST  | `/api/auth/register` | все       | `{ name, email, password, timezone?, theme? }` → `{ token, user }` |
| POST  | `/api/auth/login`    | все       | `{ email, password }` → `{ token, user }`       |
| GET   | `/api/auth/me`       | по токену | текущий пользователь `{ user }`                 |
| PATCH | `/api/auth/me`       | по токену | `{ theme: 'graphite' \| 'day' \| 'ink' }` → `{ user }` |
| POST  | `/api/events`        | по токену | создать мероприятие (см. ниже) → `{ event }`; организатор сразу участник |
| GET   | `/api/events`        | по токену | мероприятия, где я участник → `{ events }` |
| GET   | `/api/events/:code`  | все       | мероприятие по коду ссылки; список участников — только участникам |
| POST  | `/api/events/:code/join` | по токену | присоединиться (повторно — без дублей) → `{ event }` |
| GET   | `/api/events/:code/availability` | участник | мои отметки → `{ slots: [{ start: 'YYYY-MM-DDTHH:MM', level }] }` |
| GET   | `/api/events/:code/heatmap` | участник | общая карта: `{ total, responded, slots: [{ start, free: [id], maybe: [id] }] }` — агрегация в PostgreSQL (`GROUP BY slot_start`, `array_agg … FILTER`) |
| GET   | `/api/events/:code/suggestions` | участник | до трёх непересекающихся лучших окон → `{ suggestions: [{ start, end, score, free, maybe, busy }] }` |
| PATCH | `/api/events/:code/participants/:id` | организатор | `{ isRequired }` — обязательный участник |
| POST  | `/api/events/:code/finalize` | организатор | `{ start }` — назначить время; мероприятие закрывается для отметок |
| POST  | `/api/events/:code/reopen` | организатор | вернуть к выбору; отметки сохраняются |
| PUT   | `/api/events/:code/availability` | участник | заменить все мои отметки: `{ slots: [{ start, level? }] }` → `{ saved }`; клетки вне сетки — 400, закрытое мероприятие — 409 |

Тело `POST /api/events`: `{ title, description?, dateFrom: 'YYYY-MM-DD', dateTo, dayStart: 'HH:MM', dayEnd,
durationMin, slotStepMin: 15 | 30 | 60 }`. Проверки: диапазон до 31 дня и не в прошлом, конец дня позже
начала, время и длительность кратны шагу, встреча помещается в часы дня. Время пока «настенное», без
часовых поясов (этап 6).

## Как подбирается лучшее время

Алгоритм — чистая функция `server/src/lib/suggest.ts`, покрыт unit-тестами (`npm test` в `server/`).

1. Окно = длительность встречи / шаг клетки подряд идущих клеток одного дня.
2. Для каждого участника берётся **минимальный** уровень по окну: человек должен быть свободен всю встречу.
3. Баллы: свободен — 1, «если очень надо» — 0,5, занят — 0. Окна, где занят обязательный участник, отбрасываются.
4. Сортировка: больше баллов, при равенстве — раньше. Возвращаются до трёх непересекающихся окон.

## Полезные команды

| Команда (в `server/`)  | Что делает                            |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | запуск API с автоперезагрузкой        |
| `npm run db:migrate`   | создать и применить миграцию          |
| `npm run db:studio`    | Prisma Studio — просмотр данных в БД  |
| `npm run lint`         | ESLint                                |
| `npm run typecheck`    | проверка типов                        |
| `npm test`             | unit-тесты (Vitest)                   |

## Роадмап

- [x] **Этап 0.** Подготовка: структура, Docker, Express, React, Prisma
- [x] **Этап 1.** Регистрация и вход (JWT)
- [x] **Этап 2.** Создание мероприятий и приглашение по ссылке
- [x] **Этап 3.** Сетка доступности с закрашиванием
- [x] **Этап 4.** Тепловая карта (MVP)
- [x] **Этап 5.** Подбор лучшего слота и финализация
- [ ] **Этап 6.** WebSocket, часовые пояса, экспорт в календарь, гостевой вход
- [ ] **Этап 7.** Адаптив, деплой, документация
