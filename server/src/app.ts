import cors from 'cors';
import express from 'express';
import { prisma } from './db.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  let db: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'error';
  }
  res.status(db === 'ok' ? 200 : 503).json({ status: 'ok', db, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Не найдено' });
});

app.use(errorHandler);
