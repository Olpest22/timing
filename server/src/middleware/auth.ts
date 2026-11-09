import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http.js';
import { verifyToken } from '../lib/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

/** Пропускает запрос дальше только с валидным токеном в заголовке Authorization: Bearer <token>. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, 'Требуется авторизация');
  req.userId = payload.userId;
  next();
}

/** Токен необязателен: если он есть и валиден — запоминаем пользователя, иначе запрос анонимный. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (payload) req.userId = payload.userId;
  next();
}
