import { Prisma, type Event, type Participant, type User } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { generateEventCode } from '../lib/eventCode.js';
import { HttpError } from '../lib/http.js';
import { dateToDay, dateToTime, dayToDate, minutesOf, timeToDate, today } from '../lib/time.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

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
  res.json({ event: serialize(await findByCode(event.publicCode), req.userId) });
});
