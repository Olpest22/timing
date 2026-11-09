import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from './api';

export type EventChange = 'availability' | 'participants' | 'status' | 'details' | 'deleted';

/**
 * Живые обновления мероприятия: сервер присылает только «что изменилось», данные
 * перезапрашиваются через API. Несколько изменений подряд схлопываются в одно (300 мс).
 */
export function useEventLive(
  code: string,
  enabled: boolean,
  onChange: (changes: Set<EventChange>) => void,
) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    const socket: Socket = io({ path: '/socket.io', auth: { token: tokenStorage.get() } });
    let pending = new Set<EventChange>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    socket.on('connect', () => {
      socket.emit('subscribe', code, (ok: boolean) => setConnected(ok));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('event:changed', (msg: { code: string; change: EventChange }) => {
      if (msg.code !== code) return;
      pending.add(msg.change);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = pending;
        pending = new Set();
        handler.current(batch);
      }, 300);
    });

    return () => {
      clearTimeout(timer);
      socket.emit('unsubscribe', code);
      socket.disconnect();
    };
  }, [code, enabled]);

  return { connected };
}
