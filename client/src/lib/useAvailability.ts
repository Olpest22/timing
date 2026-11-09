import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { availabilityApi, type Level } from './events';

export type SaveState = 'idle' | 'pending' | 'saved' | 'error';

const SAVE_DELAY = 700;

/**
 * Мои отметки в мероприятии: загрузка, локальные изменения и автосохранение.
 * Сохраняется весь набор целиком; ответы на устаревшие запросы игнорируются.
 */
export function useAvailability(code: string, enabled: boolean, onSaved?: () => void) {
  const [selected, setSelected] = useState<Map<string, Level>>(() => new Map());
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef(selected);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const load = useCallback(() => {
    availabilityApi
      .mine(code)
      .then((slots) => {
        const map = new Map(slots.map((s) => [s.start, s.level]));
        latest.current = map;
        setSelected(map);
        setLoadState('ok');
      })
      .catch(() => setLoadState('error'));
  }, [code]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const mySeq = ++seq.current;
    setSaveState('pending');
    try {
      await availabilityApi.save(code, latest.current);
      if (mySeq !== seq.current) return; // пока шёл запрос, появились новые изменения
      setSaveState('saved');
      setSaveError(null);
      onSavedRef.current?.();
    } catch (e) {
      if (mySeq !== seq.current) return;
      setSaveState('error');
      setSaveError(e instanceof ApiError ? e.message : 'Нет связи с сервером');
    }
  }, [code]);

  /** Заменить весь набор отметок (протягивание, ручки, очистка) */
  const setSelection = useCallback(
    (next: Map<string, Level>) => {
      const cur = latest.current;
      if (next.size === cur.size && [...next].every(([k, l]) => cur.get(k) === l)) return;
      latest.current = next;
      setSelected(next);
      setSaveState('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY);
    },
    [save],
  );

  // Несохранённые изменения: предупреждаем при закрытии вкладки
  useEffect(() => {
    if (saveState !== 'pending' && saveState !== 'error') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    selected,
    loadState,
    reload: load,
    setSelection,
    saveState,
    saveError,
    retry: save,
  };
}
