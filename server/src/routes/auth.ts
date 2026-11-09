import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/http.js';
import { signToken } from '../lib/jwt.js';
import { THEMES } from '../lib/themes.js';
import { publicUser } from '../lib/users.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const email = z.string().trim().toLowerCase().pipe(z.email('Некорректный email'));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Имя — минимум 2 символа').max(100, 'Имя слишком длинное'),
  email,
  password: z.string().min(6, 'Пароль — минимум 6 символов').max(100, 'Пароль слишком длинный'),
  timezone: z.string().max(50).optional(),
  theme: z.enum(THEMES).optional(),
});

const updateMeSchema = z.object({
  theme: z.enum(THEMES, 'Неизвестная палитра'),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Введите пароль'),
});

authRouter.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, 'Пользователь с таким email уже существует');

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      ...(data.timezone && { timezone: data.timezone }),
      ...(data.theme && { theme: data.theme }),
    },
  });

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const ok = user?.passwordHash && (await bcrypt.compare(data.password, user.passwordHash));
  if (!user || !ok) throw new HttpError(401, 'Неверный email или пароль');

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(401, 'Пользователь не найден');
  res.json({ user: publicUser(user) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const data = updateMeSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data: { theme: data.theme } });
  res.json({ user: publicUser(user) });
});
