import { Prisma, type Event, type Participant, type User } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { generateEventCode } from '../lib/eventCode.js';
import { HttpError } from '../lib/http.js';
import { dateToDay, dateToTime, dayToDate, minutesOf, timeToDate, today } from '../lib/time.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { suggest, type Level } from '../lib/suggest.js';
import { buildIcs } from '../lib/ics.js';
import { isValidTimeZone, wallToUtc } from '../lib/tz.js';
import { notifyEvent } from '../realtime.js';

export const eventsRouter = Router();

const MAX_DAYS = 31;
const STEPS = [15, 30, 60] as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');
const day = z.iso.date('Дата в формате ГГГГ-ММ-ДД');

const createSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Название — минимум 2 символа')
      .max(200, 'Название слишком длинное'),
    description: z.string().trim().max(1000, 'Описание слишком длинное').optional(),
    dateFrom: day,
    dateTo: day,
    dayStart: hhmm,
    dayEnd: hhmm,
    durationMin: z
      .number()
      .int()
      .min(15, 'Длительность — от 15 минут')
      .max(12 * 60, 'Длительность — до 12 часов'),
    timezone: z
      .string()
      .max(50)
      .refine(isValidTimeZone, 'Неизвестный часовой пояс')
      .default('Europe/Moscow'),
    deadline: day.optional(),
    slotStepMin: z.union(
      STEPS.map((s) => z.literal(s)) as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<60>],
      {
        error: 'Шаг сетки — 15, 30 или 60 минут',
      },
    ),
  })
  .superRefine((d, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (d.dateTo < d.dateFrom) issue('dateTo', 'Дата окончания раньше даты начала');
    else if ((Date.parse(d.dateTo) - Date.parse(d.dateFrom)) / 86_400_000 + 1 > MAX_DAYS)
      issue('dateTo', `Диапазон — не больше ${MAX_DAYS} дня`);
    if (d.dateTo < today()) issue('dateTo', 'Диапазон уже прошёл');
    if (d.deadline && d.deadline > d.dateTo) issue('deadline', 'Срок отметки позже последнего дня');
    if (d.deadline && d.deadline < today()) issue('deadline', 'Срок отметки уже прошёл');

    const start = minutesOf(d.dayStart);
    const end = minutesOf(d.dayEnd);
    if (start % d.slotStepMin)
      issue('dayStart', `Начало должно попадать на шаг сетки (${d.slotStepMin} мин)`);
    if (end % d.slotStepMin)
      issue('dayEnd', `Конец должен попадать на шаг сетки (${d.slotStepMin} мин)`);
    if (end <= start) issue('dayEnd', 'Конец дня должен быть позже начала');
    else if (d.durationMin > end - start)
      issue('durationMin', 'Мероприятие не помещается в часы дня');
    if (d.durationMin % d.slotStepMin)
      issue('durationMin', `Длительность должна быть кратна шагу (${d.slotStepMin} мин)`);
  });

type EventWithPeople = Event & {
  organizer: User;
  participants: (Participant & { user: User })[];
};

const withPeople = {
  organizer: true,
  participants: { include: { user: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.EventInclude;

/** Мероприятие для клиента. Список участников видят только сами участники. */
function serialize(event: EventWithPeople, userId?: number) {
  const me = event.participants.find((p) => p.userId === userId);
  return {
    code: event.publicCode,
    title: event.title,
    description: event.description,
    dateFrom: dateToDay(event.dateFrom),
    dateTo: dateToDay(event.dateTo),
    dayStart: dateToTime(event.dayStart),
    dayEnd: dateToTime(event.dayEnd),
    durationMin: event.durationMin,
    slotStepMin: event.slotStepMin,
    timezone: event.timezone,
    deadline: event.deadline ? dateToDay(event.deadline) : null,
    status: event.status,
    finalStart: event.finalStart?.toISOString() ?? null,
    organizer: { id: event.organizer.id, name: event.organizer.name },
    participantCount: event.participants.length,
    respondedCount: event.participants.filter((p) => p.responded).length,
    me: me ? { isOrganizer: event.organizerId === userId, responded: me.responded } : null,
    participants: me
      ? event.participants.map((p) => ({
          id: p.id,
          name: p.user.name,
          isOrganizer: p.userId === event.organizerId,
          isMe: p.userId === userId,
          isRequired: p.isRequired,
          responded: p.responded,
        }))
      : null,
  };
}

async function findByCode(code: string) {
  const event = await prisma.event.findUnique({ where: { publicCode: code }, include: withPeople });
  if (!event) throw new HttpError(404, 'Мероприятие не найдено');
  return event;
}

eventsRouter.post('/', requireAuth, async (req, res) => {
  const d = createSchema.parse(req.body);

  // Код случайный; при редком совпадении пробуем ещё раз
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const event = await prisma.event.create({
        data: {
          publicCode: generateEventCode(),
          organizerId: req.userId!,
          title: d.title,
          description: d.description || null,
          dateFrom: dayToDate(d.dateFrom),
          dateTo: dayToDate(d.dateTo),
          dayStart: timeToDate(d.dayStart),
          dayEnd: timeToDate(d.dayEnd),
          durationMin: d.durationMin,
          slotStepMin: d.slotStepMin,
          timezone: d.timezone,
          deadline: d.deadline ? dayToDate(d.deadline) : null,
          participants: { create: { userId: req.userId! } }, // организатор — тоже участник
        },
        include: withPeople,
      });
      res.status(201).json({ event: serialize(event, req.userId) });
      return;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
  throw new HttpError(500, 'Не удалось создать код мероприятия, попробуйте ещё раз');
});

eventsRouter.get('/', requireAuth, async (req, res) => {
  const events = await prisma.event.findMany({
    where: { participants: { some: { userId: req.userId } } },
    include: withPeople,
    orderBy: [{ dateFrom: 'asc' }, { id: 'asc' }],
  });
  res.json({ events: events.map((e) => serialize(e, req.userId)) });
});

eventsRouter.get('/:code', optionalAuth, async (req, res) => {
  const event = await findByCode(String(req.params.code));
  res.json({ event: serialize(event, req.userId) });
});

eventsRouter.post('/:code/join', requireAuth, async (req, res) => {
  const event = await findByCode(String(req.params.code));
  if (event.status === 'closed')
    throw new HttpError(409, 'Время уже назначено, присоединиться нельзя');

  await prisma.participant.upsert({
    where: { eventId_userId: { eventId: event.id, userId: req.userId! } },
    create: { eventId: event.id, userId: req.userId! },
    update: {},
  });
  notifyEvent(event.publicCode, 'participants');
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});

// ── Доступность: отметки текущего участника ─────────────────────────────────────

const slotSchema = z.object({
  /** Начало клетки, «настенное» время: 2026-11-16T10:30 */
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Клетка в формате ГГГГ-ММ-ДДTЧЧ:ММ'),
  /** 2 — свободен, 1 — «если очень надо» (этап 5) */
  level: z.union([z.literal(1), z.literal(2)]).default(2),
});
const putAvailabilitySchema = z.object({ slots: z.array(slotSchema).max(31 * 96) });

/** Слот → значение колонки slot_start (храним «настенное» время как UTC) */
const slotToDate = (start: string) => new Date(`${start}:00Z`);
const dateToSlot = (d: Date) => d.toISOString().slice(0, 16);

async function requireParticipant(code: string, userId: number) {
  const event = await findByCode(code);
  const me = event.participants.find((p) => p.userId === userId);
  if (!me) throw new HttpError(403, 'Сначала присоединитесь к мероприятию');
  return { event, me };
}

eventsRouter.get('/:code/availability', requireAuth, async (req, res) => {
  const { me } = await requireParticipant(String(req.params.code), req.userId!);
  const rows = await prisma.availability.findMany({
    where: { participantId: me.id },
    orderBy: { slotStart: 'asc' },
  });
  res.json({ slots: rows.map((r) => ({ start: dateToSlot(r.slotStart), level: r.level })) });
});

eventsRouter.put('/:code/availability', requireAuth, async (req, res) => {
  const { event, me } = await requireParticipant(String(req.params.code), req.userId!);
  if (event.status === 'closed') throw new HttpError(409, 'Время уже назначено, отметки закрыты');
  const { slots } = putAvailabilitySchema.parse(req.body);

  // Каждая клетка — внутри сетки мероприятия: дата в диапазоне, время в часах дня и на шаге
  const from = dateToDay(event.dateFrom);
  const to = dateToDay(event.dateTo);
  const dayStart = minutesOf(dateToTime(event.dayStart));
  const dayEnd = minutesOf(dateToTime(event.dayEnd));
  const unique = new Map<string, number>();
  for (const s of slots) {
    const [date, time] = s.start.split('T');
    const m = minutesOf(time);
    const inGrid =
      date >= from &&
      date <= to &&
      m >= dayStart &&
      m < dayEnd &&
      (m - dayStart) % event.slotStepMin === 0;
    if (!inGrid) throw new HttpError(400, `Клетка ${s.start} вне сетки мероприятия`);
    unique.set(s.start, s.level);
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { participantId: me.id } }),
    prisma.availability.createMany({
      data: [...unique].map(([start, level]) => ({
        participantId: me.id,
        slotStart: slotToDate(start),
        level,
      })),
    }),
    prisma.participant.update({ where: { id: me.id }, data: { responded: unique.size > 0 } }),
  ]);

  notifyEvent(event.publicCode, 'availability');
  res.json({ saved: unique.size });
});

// ── Тепловая карта ───────────────────────────────────────────────────────────────

eventsRouter.get('/:code/heatmap', requireAuth, async (req, res) => {
  const { event } = await requireParticipant(String(req.params.code), req.userId!);

  // Агрегация в БД: по каждой клетке — кто свободен (уровень 2) и кто «если очень надо» (1)
  const rows = await prisma.$queryRaw<{ slot_start: Date; free: number[]; maybe: number[] }[]>`
    SELECT a.slot_start,
           COALESCE(array_agg(a.participant_id ORDER BY a.participant_id) FILTER (WHERE a.level = 2), '{}') AS free,
           COALESCE(array_agg(a.participant_id ORDER BY a.participant_id) FILTER (WHERE a.level = 1), '{}') AS maybe
    FROM availability a
    JOIN participants p ON p.id = a.participant_id
    WHERE p.event_id = ${event.id}
    GROUP BY a.slot_start
    ORDER BY a.slot_start`;

  res.json({
    total: event.participants.length,
    responded: event.participants.filter((p) => p.responded).length,
    slots: rows.map((r) => ({ start: dateToSlot(r.slot_start), free: r.free, maybe: r.maybe })),
  });
});

// ── Лучшее время, обязательные участники, назначение ────────────────────────────

/** Дни и начала клеток мероприятия */
function grid(event: Event) {
  const from = dayToDate(dateToDay(event.dateFrom));
  const n = Math.round((event.dateTo.getTime() - event.dateFrom.getTime()) / 86_400_000) + 1;
  const days = Array.from({ length: n }, (_, i) =>
    dateToDay(new Date(from.getTime() + i * 86_400_000)),
  );
  const start = minutesOf(dateToTime(event.dayStart));
  const end = minutesOf(dateToTime(event.dayEnd));
  const rows = Array.from(
    { length: (end - start) / event.slotStepMin },
    (_, i) => start + i * event.slotStepMin,
  );
  return { days, rows };
}

eventsRouter.get('/:code/suggestions', requireAuth, async (req, res) => {
  const { event } = await requireParticipant(String(req.params.code), req.userId!);
  const rows = await prisma.availability.findMany({
    where: { participant: { eventId: event.id } },
  });
  const availability = new Map<string, Map<number, Level>>();
  for (const r of rows) {
    const k = dateToSlot(r.slotStart);
    if (!availability.has(k)) availability.set(k, new Map());
    availability.get(k)!.set(r.participantId, r.level as Level);
  }
  const { days, rows: dayRows } = grid(event);
  res.json({
    suggestions: suggest({
      days,
      rows: dayRows,
      stepMin: event.slotStepMin,
      durationMin: event.durationMin,
      participants: event.participants.map((p) => ({ id: p.id, required: p.isRequired })),
      availability,
    }),
  });
});

async function requireOrganizer(code: string, userId: number) {
  const event = await findByCode(code);
  if (event.organizerId !== userId)
    throw new HttpError(403, 'Это может сделать только организатор');
  return event;
}

eventsRouter.patch('/:code/participants/:id', requireAuth, async (req, res) => {
  const event = await requireOrganizer(String(req.params.code), req.userId!);
  const { isRequired } = z.object({ isRequired: z.boolean() }).parse(req.body);
  const participant = event.participants.find((p) => p.id === Number(req.params.id));
  if (!participant) throw new HttpError(404, 'Участник не найден');
  await prisma.participant.update({ where: { id: participant.id }, data: { isRequired } });
  notifyEvent(event.publicCode, 'participants');
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});

eventsRouter.post('/:code/finalize', requireAuth, async (req, res) => {
  const event = await requireOrganizer(String(req.params.code), req.userId!);
  const { start } = z
    .object({
      start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ГГГГ-ММ-ДДTЧЧ:ММ'),
    })
    .parse(req.body);

  // Встреча целиком внутри сетки: день в диапазоне, начало на шаге, конец не позже конца дня
  const { days, rows } = grid(event);
  const [day, time] = start.split('T');
  const m = minutesOf(time);
  const dayEnd = minutesOf(dateToTime(event.dayEnd));
  if (!days.includes(day) || !rows.includes(m) || m + event.durationMin > dayEnd) {
    throw new HttpError(400, 'Время вне сетки мероприятия');
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'closed', finalStart: slotToDate(start) },
  });
  notifyEvent(event.publicCode, 'status');
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});

eventsRouter.post('/:code/reopen', requireAuth, async (req, res) => {
  const event = await requireOrganizer(String(req.params.code), req.userId!);
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'open', finalStart: null },
  });
  notifyEvent(event.publicCode, 'status');
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});

// ── Правка, удаление, календарь ──────────────────────────────────────────────────

const patchSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Название — минимум 2 символа')
    .max(200, 'Название слишком длинное')
    .optional(),
  description: z.string().trim().max(1000, 'Описание слишком длинное').nullable().optional(),
  deadline: day.nullable().optional(),
});

/** Меняются только название, описание и срок: сетку не трогаем, чтобы не потерять отметки */
eventsRouter.patch('/:code', requireAuth, async (req, res) => {
  const event = await requireOrganizer(String(req.params.code), req.userId!);
  const d = patchSchema.parse(req.body);
  if (d.deadline && d.deadline > dateToDay(event.dateTo)) {
    throw new HttpError(400, 'Срок отметки позже последнего дня');
  }
  await prisma.event.update({
    where: { id: event.id },
    data: {
      ...(d.title !== undefined && { title: d.title }),
      ...(d.description !== undefined && { description: d.description || null }),
      ...(d.deadline !== undefined && { deadline: d.deadline ? dayToDate(d.deadline) : null }),
    },
  });
  notifyEvent(event.publicCode, 'details');
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});

eventsRouter.delete('/:code', requireAuth, async (req, res) => {
  const event = await requireOrganizer(String(req.params.code), req.userId!);
  // Отметки и участники удаляются каскадом (onDelete: Cascade)
  await prisma.event.delete({ where: { id: event.id } });
  notifyEvent(event.publicCode, 'deleted');
  res.status(204).end();
});

eventsRouter.get('/:code/ics', async (req, res) => {
  const event = await findByCode(String(req.params.code));
  if (event.status !== 'closed' || !event.finalStart)
    throw new HttpError(409, 'Время ещё не назначено');
  const start = wallToUtc(dateToSlot(event.finalStart), event.timezone);
  const end = new Date(start.getTime() + event.durationMin * 60_000);
  const url = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/e/${event.publicCode}`;
  res
    .type('text/calendar; charset=utf-8')
    .attachment(`timing-${event.publicCode}.ics`)
    .send(
      buildIcs({
        uid: `${event.publicCode}@timing`,
        title: event.title,
        description: event.description,
        url,
        start,
        end,
      }),
    );
});
