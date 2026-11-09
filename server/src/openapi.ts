/* Описание API в формате OpenAPI 3.1: интерфейс — /api/docs, JSON — /api/openapi.json */

const bearer = [{ bearer: [] }];
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const ok = (description: string, schema?: object) => ({ description, ...(schema && json(schema)) });
const err = (description: string) => ({
  description,
  ...json({ $ref: '#/components/schemas/Error' }),
});
const code = {
  name: 'code',
  in: 'path',
  required: true,
  schema: { type: 'string', example: 'retro234' },
};
const eventRes = { type: 'object', properties: { event: { $ref: '#/components/schemas/Event' } } };

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Тайминг API',
    version: '1.0.0',
    description:
      'Планирование командных мероприятий: участники отмечают свободное время, сервис строит тепловую карту и подбирает лучшее окно. Время в сетке — «настенное», в поясе мероприятия (`timezone`).',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
        },
        example: {
          error: 'Название — минимум 2 символа',
          fields: { title: 'Название — минимум 2 символа' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: ['string', 'null'] },
          timezone: { type: 'string' },
          theme: { type: 'string', enum: ['graphite', 'day', 'ink'] },
          isGuest: { type: 'boolean' },
        },
      },
      Auth: {
        type: 'object',
        properties: { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } },
      },
      Participant: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          isOrganizer: { type: 'boolean' },
          isMe: { type: 'boolean' },
          isRequired: { type: 'boolean' },
          responded: { type: 'boolean' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'retro234' },
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
          dayStart: { type: 'string', example: '10:00' },
          dayEnd: { type: 'string', example: '19:00' },
          durationMin: { type: 'integer', example: 120 },
          slotStepMin: { type: 'integer', enum: [15, 30, 60] },
          timezone: { type: 'string', example: 'Europe/Moscow' },
          deadline: { type: ['string', 'null'], format: 'date' },
          status: { type: 'string', enum: ['open', 'closed'] },
          finalStart: {
            type: ['string', 'null'],
            description: 'Начало назначенной встречи (настенное время)',
          },
          organizer: {
            type: 'object',
            properties: { id: { type: 'integer' }, name: { type: 'string' } },
          },
          participantCount: { type: 'integer' },
          respondedCount: { type: 'integer' },
          me: {
            type: ['object', 'null'],
            properties: { isOrganizer: { type: 'boolean' }, responded: { type: 'boolean' } },
          },
          participants: {
            type: ['array', 'null'],
            items: { $ref: '#/components/schemas/Participant' },
            description: 'Только для участников',
          },
        },
      },
      NewEvent: {
        type: 'object',
        required: [
          'title',
          'dateFrom',
          'dateTo',
          'dayStart',
          'dayEnd',
          'durationMin',
          'slotStepMin',
        ],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: {
            type: 'string',
            format: 'date',
            description: 'Не больше 31 дня от dateFrom, не в прошлом',
          },
          dayStart: { type: 'string', example: '10:00' },
          dayEnd: { type: 'string', example: '19:00' },
          durationMin: {
            type: 'integer',
            example: 120,
            description: 'Кратна шагу и помещается в часы дня',
          },
          slotStepMin: { type: 'integer', enum: [15, 30, 60] },
          timezone: { type: 'string', example: 'Europe/Moscow' },
          deadline: { type: 'string', format: 'date' },
        },
      },
      Slot: {
        type: 'object',
        properties: {
          start: { type: 'string', example: '2026-11-17T16:00' },
          level: {
            type: 'integer',
            enum: [1, 2],
            description: '2 — свободен, 1 — «если очень надо»',
          },
        },
      },
      Suggestion: {
        type: 'object',
        properties: {
          start: { type: 'string', example: '2026-11-17T16:00' },
          end: { type: 'string', example: '2026-11-17T18:00' },
          score: { type: 'number', example: 2.5 },
          free: { type: 'array', items: { type: 'integer' } },
          maybe: { type: 'array', items: { type: 'integer' } },
          busy: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Служебное'],
        summary: 'Проверка API и БД',
        responses: { 200: ok('Работает'), 503: ok('БД недоступна') },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Вход'],
        summary: 'Регистрация',
        requestBody: json({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            password: { type: 'string', minLength: 6 },
            timezone: { type: 'string' },
            theme: { type: 'string' },
          },
        }),
        responses: {
          201: ok('Создан', { $ref: '#/components/schemas/Auth' }),
          400: err('Ошибки полей'),
          409: err('Email занят'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Вход'],
        summary: 'Вход',
        requestBody: json({
          type: 'object',
          properties: { email: { type: 'string' }, password: { type: 'string' } },
        }),
        responses: {
          200: ok('Токен', { $ref: '#/components/schemas/Auth' }),
          401: err('Неверный email или пароль'),
        },
      },
    },
    '/auth/guest': {
      post: {
        tags: ['Вход'],
        summary: 'Вход по ссылке только с именем',
        requestBody: json({ type: 'object', properties: { name: { type: 'string' } } }),
        responses: { 201: ok('Токен гостя', { $ref: '#/components/schemas/Auth' }) },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Вход'],
        summary: 'Текущий пользователь',
        security: bearer,
        responses: { 200: ok('Пользователь'), 401: err('Нет токена') },
      },
      patch: {
        tags: ['Вход'],
        summary: 'Сменить палитру',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: { theme: { type: 'string', enum: ['graphite', 'day', 'ink'] } },
        }),
        responses: { 200: ok('Пользователь') },
      },
    },
    '/events': {
      get: {
        tags: ['Мероприятия'],
        summary: 'Мои мероприятия',
        security: bearer,
        responses: { 200: ok('Список') },
      },
      post: {
        tags: ['Мероприятия'],
        summary: 'Создать (организатор сразу участник)',
        security: bearer,
        requestBody: json({ $ref: '#/components/schemas/NewEvent' }),
        responses: { 201: ok('Создано', eventRes), 400: err('Ошибки полей') },
      },
    },
    '/events/{code}': {
      parameters: [code],
      get: {
        tags: ['Мероприятия'],
        summary: 'По коду ссылки (открыто всем; участники — только участникам)',
        responses: { 200: ok('Мероприятие', eventRes), 404: err('Нет такого') },
      },
      patch: {
        tags: ['Мероприятия'],
        summary: 'Изменить название, описание, срок (организатор)',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            deadline: { type: ['string', 'null'] },
          },
        }),
        responses: { 200: ok('Мероприятие', eventRes), 403: err('Не организатор') },
      },
      delete: {
        tags: ['Мероприятия'],
        summary: 'Удалить вместе с отметками (организатор)',
        security: bearer,
        responses: { 204: ok('Удалено'), 403: err('Не организатор') },
      },
    },
    '/events/{code}/join': {
      parameters: [code],
      post: {
        tags: ['Мероприятия'],
        summary: 'Присоединиться (повторно — без дублей)',
        security: bearer,
        responses: { 200: ok('Мероприятие', eventRes), 409: err('Время уже назначено') },
      },
    },
    '/events/{code}/availability': {
      parameters: [code],
      get: {
        tags: ['Отметки'],
        summary: 'Мои отметки',
        security: bearer,
        responses: {
          200: ok('Отметки', {
            type: 'object',
            properties: { slots: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } },
          }),
          403: err('Не участник'),
        },
      },
      put: {
        tags: ['Отметки'],
        summary: 'Заменить все мои отметки',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: { slots: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } },
        }),
        responses: {
          200: ok('Сохранено'),
          400: err('Клетка вне сетки'),
          409: err('Время уже назначено'),
        },
      },
    },
    '/events/{code}/heatmap': {
      parameters: [code],
      get: {
        tags: ['Отметки'],
        summary: 'Тепловая карта: кто свободен в каждой клетке (агрегация в PostgreSQL)',
        security: bearer,
        responses: {
          200: ok('Карта', {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              responded: { type: 'integer' },
              slots: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'string' },
                    free: { type: 'array', items: { type: 'integer' } },
                    maybe: { type: 'array', items: { type: 'integer' } },
                  },
                },
              },
            },
          }),
        },
      },
    },
    '/events/{code}/suggestions': {
      parameters: [code],
      get: {
        tags: ['Назначение'],
        summary: 'До трёх лучших непересекающихся окон',
        security: bearer,
        responses: {
          200: ok('Варианты', {
            type: 'object',
            properties: {
              suggestions: { type: 'array', items: { $ref: '#/components/schemas/Suggestion' } },
            },
          }),
        },
      },
    },
    '/events/{code}/participants/{id}': {
      parameters: [code, { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      patch: {
        tags: ['Назначение'],
        summary: 'Обязательный участник (организатор)',
        security: bearer,
        requestBody: json({ type: 'object', properties: { isRequired: { type: 'boolean' } } }),
        responses: { 200: ok('Мероприятие', eventRes) },
      },
    },
    '/events/{code}/finalize': {
      parameters: [code],
      post: {
        tags: ['Назначение'],
        summary: 'Назначить время (организатор)',
        security: bearer,
        requestBody: json({
          type: 'object',
          properties: { start: { type: 'string', example: '2026-11-17T16:00' } },
        }),
        responses: {
          200: ok('Мероприятие', eventRes),
          400: err('Вне сетки'),
          403: err('Не организатор'),
        },
      },
    },
    '/events/{code}/reopen': {
      parameters: [code],
      post: {
        tags: ['Назначение'],
        summary: 'Вернуть к выбору (организатор)',
        security: bearer,
        responses: { 200: ok('Мероприятие', eventRes) },
      },
    },
    '/events/{code}/ics': {
      parameters: [code],
      get: {
        tags: ['Назначение'],
        summary: 'Файл календаря назначенной встречи (UTC)',
        responses: { 200: { description: 'text/calendar' }, 409: err('Время не назначено') },
      },
    },
  },
};
