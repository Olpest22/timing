import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { prisma } from './db.js';
import { openapi } from './openapi.js';
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

// Документация API
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapi);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Тайминг API' }));

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Не найдено' });
});

// В продакшене сервер сам отдаёт собранный фронтенд (CLIENT_DIST — папка client/dist):
// одна служба на одном адресе, без CORS. Все неизвестные пути — index.html (маршруты React).
const clientDist = process.env.CLIENT_DIST && resolve(process.env.CLIENT_DIST);
if (clientDist && existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}

app.use(errorHandler);
