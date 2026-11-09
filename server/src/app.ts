import cors from 'cors';
import express from 'express';
import { prisma } from './db.js';

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
