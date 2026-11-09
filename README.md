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
| POST  | `/api/auth/register` | все       | `{ name, email, password, timezone? }` → `{ token, user }` |
| POST  | `/api/auth/login`    | все       | `{ email, password }` → `{ token, user }`       |
| GET   | `/api/auth/me`       | по токену | текущий пользователь `{ user }`                 |

## Полезные команды

| Команда (в `server/`)  | Что делает                            |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | запуск API с автоперезагрузкой        |
| `npm run db:migrate`   | создать и применить миграцию          |
| `npm run db:studio`    | Prisma Studio — просмотр данных в БД  |
| `npm run lint`         | ESLint                                |
| `npm run typecheck`    | проверка типов                        |

## Роадмап

- [x] **Этап 0.** Подготовка: структура, Docker, Express, React, Prisma
- [x] **Этап 1.** Регистрация и вход (JWT)
- [ ] **Этап 2.** Создание мероприятий и приглашение по ссылке
- [ ] **Этап 3.** Сетка доступности с закрашиванием
- [ ] **Этап 4.** Тепловая карта (MVP)
- [ ] **Этап 5.** Подбор лучшего слота и финализация
- [ ] **Этап 6.** WebSocket, часовые пояса, экспорт в календарь, гостевой вход
- [ ] **Этап 7.** Адаптив, деплой, документация
