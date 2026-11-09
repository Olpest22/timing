import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { prisma } from './db.js';
import { verifyToken } from './lib/jwt.js';

/*
 * Живые обновления. Клиент подписывается на мероприятие, сервер сообщает «изменилось» —
 * без данных: клиент сам перезапрашивает их через API с обычной проверкой прав.
 */

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: process.env.CLIENT_URL ?? 'http://localhost:5173' },
  });

  io.on('connection', (socket) => {
    const payload = verifyToken(String(socket.handshake.auth?.token ?? ''));

    socket.on('subscribe', async (code: unknown, ack?: (ok: boolean) => void) => {
      if (typeof code !== 'string') return ack?.(false);
      // Только участники получают сигналы о мероприятии
      const member = payload
        ? await prisma.participant.findFirst({
            where: { userId: payload.userId, event: { publicCode: code } },
          })
        : null;
      if (!member) return ack?.(false);
      await socket.join(`event:${code}`);
      ack?.(true);
    });

    socket.on('unsubscribe', (code: unknown) => {
      if (typeof code === 'string') socket.leave(`event:${code}`);
    });
  });
}

export type EventChange = 'availability' | 'participants' | 'status' | 'details' | 'deleted';

/** Сообщить участникам, что мероприятие изменилось */
export function notifyEvent(code: string, change: EventChange) {
  io?.to(`event:${code}`).emit('event:changed', { code, change });
}
