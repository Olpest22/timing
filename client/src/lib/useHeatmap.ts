import { useCallback, useEffect, useState } from 'react';
import { heatmapApi, type Heatmap } from './events';

/**
 * Общая карта мероприятия. Обновляется по запросу (после своего сохранения) и при
 * возвращении во вкладку — живые обновления через WebSocket появятся на этапе 6.
 */
export function useHeatmap(code: string, enabled: boolean) {
  const [heat, setHeat] = useState<Heatmap | null>(null);
  const [error, setError] = useState(false);

  const refetch = useCallback(() => {
    heatmapApi
      .get(code)
      .then((h) => {
        setHeat(h);
        setError(false);
      })
      .catch(() => setError(true));
  }, [code]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    const onVisible = () => document.visibilityState === 'visible' && refetch();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, refetch]);

  return { heat, error, refetch };
}
