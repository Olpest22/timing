/*
 * Демо-данные для показа: npm run db:seed (в продакшен-образе: npm run db:seed:prod)
 * Пользователи *@demo.timing (пароль demo123) и их мероприятия пересоздаются при каждом запуске,
 * остальные данные не трогаются. Даты считаются от сегодняшнего дня.
 */
import { PrismaClient, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DOMAIN = 'demo.timing';
const PASSWORD = 'demo123';

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);
const slot = (date: Date, hhmm: string) => new Date(`${iso(date)}T${hhmm}:00Z`);
/** Ближайший понедельник не раньше чем через 3 дня */
const nextMonday = () => {
  const d = day(3);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const PEOPLE = ['Аня', 'Петя', 'Олег', 'Маша', 'Дима', 'Лена', 'Игорь', 'Света'];
const LOGINS = ['anya', 'petya', 'oleg', 'masha', 'dima', 'lena', 'igor', 'sveta'];

/** Свободные часы каждого на неделю: [день (0 = пн), с, до) */
const WEEK: [number, number, number][][] = [
  [
    [0, 10, 13],
    [1, 14, 19],
    [2, 10, 12],
    [3, 15, 19],
    [4, 10, 14],
  ],
  [
    [0, 16, 19],
    [1, 10, 12],
    [2, 13, 18],
    [3, 16, 19],
    [4, 15, 18],
  ],
  [
    [0, 10, 12],
    [1, 15, 19],
    [2, 10, 15],
    [3, 10, 13],
    [4, 12, 17],
  ],
  [
    [0, 13, 18],
    [1, 16, 19],
    [2, 17, 19],
    [3, 14, 19],
    [4, 10, 12],
  ],
  [
    [0, 11, 15],
    [1, 10, 13],
    [2, 15, 19],
    [3, 17, 19],
    [4, 13, 19],
  ],
  [
    [0, 17, 19],
    [1, 12, 17],
    [2, 10, 13],
    [3, 16, 19],
    [4, 16, 19],
  ],
  [
    [0, 10, 19],
    [3, 10, 12],
  ],
];

async function main() {
  // Пересоздаём только демо: мероприятия демо-организаторов удаляются каскадом
  const old = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.event.deleteMany({ where: { organizerId: { in: old.map((u) => u.id) } } });
  await prisma.participant.deleteMany({ where: { userId: { in: old.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users: User[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    users.push(
      await prisma.user.create({
        data: {
          name: PEOPLE[i],
          email: `${LOGINS[i]}@${DOMAIN}`,
          passwordHash,
          theme: i === 1 ? 'day' : 'graphite',
        },
      }),
    );
  }
  const [anya, , , masha] = users;
  const monday = nextMonday();

  // 1. Открытое: 7 из 8 отметились, Маша обязательная, Света ещё нет
  const retro = await prisma.event.create({
    data: {
      publicCode: 'retro234',
      organizerId: anya.id,
      title: 'Ретро спринта',
      description: 'Обсудим, что получилось за спринт.\nВозьмите ноутбуки.',
      dateFrom: monday,
      dateTo: addDays(monday, 4),
      dayStart: time('10:00'),
      dayEnd: time('19:00'),
      durationMin: 120,
      slotStepMin: 30,
      deadline: addDays(monday, -1),
      participants: { create: users.map((u) => ({ userId: u.id, isRequired: u.id === masha.id })) },
    },
    include: { participants: true },
  });
  for (let i = 0; i < WEEK.length; i++) {
    const p = retro.participants.find((x) => x.userId === users[i].id)!;
    const data = [];
    for (const [d, from, to] of WEEK[i])
      for (let m = from * 60; m < to * 60; m += 30) {
        const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        // Игорь в понедельник отмечен «если очень надо»
        data.push({
          participantId: p.id,
          slotStart: slot(addDays(monday, d), hhmm),
          level: i === 6 && d === 0 ? 1 : 2,
        });
      }
    await prisma.availability.createMany({ data });
    await prisma.participant.update({ where: { id: p.id }, data: { responded: true } });
  }

  // 2. Назначенное: время уже выбрано, у всех есть отметки вокруг него
  const pizza = await prisma.event.create({
    data: {
      publicCode: 'pizza567',
      organizerId: users[1].id,
      title: 'Пицца после релиза',
      dateFrom: addDays(monday, 7),
      dateTo: addDays(monday, 11),
      dayStart: time('17:00'),
      dayEnd: time('22:00'),
      durationMin: 90,
      slotStepMin: 30,
      status: 'closed',
      finalStart: slot(addDays(monday, 9), '19:00'),
      participants: { create: users.slice(0, 6).map((u) => ({ userId: u.id, responded: true })) },
    },
    include: { participants: true },
  });
  // Все шестеро свободны в среду 19:00–20:30, часть — ещё и во вторник вечером
  for (const [i, p] of pizza.participants.entries()) {
    const data = [];
    for (const hhmm of ['18:30', '19:00', '19:30', '20:00', '20:30'])
      data.push({ participantId: p.id, slotStart: slot(addDays(monday, 9), hhmm), level: 2 });
    if (i % 2 === 0)
      for (const hhmm of ['19:00', '19:30', '20:00'])
        data.push({ participantId: p.id, slotStart: slot(addDays(monday, 8), hhmm), level: 2 });
    await prisma.availability.createMany({ data });
  }

  // 3. Только что созданное: никто не отметился, ссылку ещё рассылают
  await prisma.event.create({
    data: {
      publicCode: 'kvartal8',
      organizerId: anya.id,
      title: 'Планирование квартала',
      dateFrom: addDays(monday, 14),
      dateTo: addDays(monday, 18),
      dayStart: time('09:00'),
      dayEnd: time('18:00'),
      durationMin: 180,
      slotStepMin: 60,
      participants: { create: [{ userId: anya.id }, { userId: users[2].id }] },
    },
  });

  console.log(
    `Готово. Вход: anya@${DOMAIN} / ${PASSWORD} (или petya, oleg, masha, dima, lena, igor, sveta).`,
  );
  console.log(
    `Мероприятия: /e/${'retro234'} (открыто), /e/${'pizza567'} (назначено), /e/${'kvartal8'} (новое).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
