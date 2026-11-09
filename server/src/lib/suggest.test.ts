import { describe, expect, it } from 'vitest';
import { suggest, slotKey, type Level, type SuggestInput } from './suggest.js';

const days = ['2026-11-16', '2026-11-17'];
const rows = [600, 630, 660, 690, 720, 750]; // 10:00 … 12:30, шаг 30

/** avail({ 1: { '2026-11-16': [[600, 720, 2]] } }) — участник 1 свободен 10:00–12:00 в пн */
function avail(spec: Record<number, Record<string, [number, number, Level][]>>) {
  const map = new Map<string, Map<number, Level>>();
  for (const [id, byDay] of Object.entries(spec))
    for (const [day, ranges] of Object.entries(byDay))
      for (const [from, to, level] of ranges)
        for (let m = from; m < to; m += 30) {
          const k = slotKey(day, m);
          if (!map.has(k)) map.set(k, new Map());
          map.get(k)!.set(Number(id), level);
        }
  return map;
}

const base = (over: Partial<SuggestInput>): SuggestInput => ({
  days,
  rows,
  stepMin: 30,
  durationMin: 60,
  participants: [
    { id: 1, required: false },
    { id: 2, required: false },
    { id: 3, required: false },
  ],
  availability: new Map(),
  ...over,
});

describe('suggest', () => {
  it('выбирает окно, где свободно больше всего людей', () => {
    const r = suggest(
      base({
        availability: avail({
          1: { '2026-11-16': [[600, 780, 2]] },
          2: { '2026-11-16': [[660, 780, 2]] },
          3: { '2026-11-16': [[690, 780, 2]] },
        }),
      }),
    );
    expect(r[0]).toMatchObject({
      start: '2026-11-16T11:30',
      end: '2026-11-16T12:30',
      score: 3,
      free: [1, 2, 3],
    });
  });

  it('человек должен быть свободен всё окно, а не его часть', () => {
    const r = suggest(
      base({
        availability: avail({
          1: { '2026-11-16': [[600, 660, 2]] },
          2: { '2026-11-16': [[630, 690, 2]] }, // пересечение только 10:30–11:00 — меньше часа
        }),
      }),
    );
    expect(r.every((s) => s.score <= 1)).toBe(true);
  });

  it('«если очень надо» даёт полбалла и уступает свободным', () => {
    const r = suggest(
      base({
        availability: avail({
          1: { '2026-11-16': [[600, 660, 1]], '2026-11-17': [[600, 660, 2]] },
          2: { '2026-11-16': [[600, 660, 2]], '2026-11-17': [[600, 660, 2]] },
        }),
      }),
    );
    expect(r[0]).toMatchObject({ start: '2026-11-17T10:00', score: 2 });
    expect(r[1]).toMatchObject({ start: '2026-11-16T10:00', score: 1.5, maybe: [1], free: [2] });
  });

  it('отбрасывает окна, где занят обязательный участник', () => {
    const r = suggest(
      base({
        participants: [
          { id: 1, required: false },
          { id: 2, required: false },
          { id: 3, required: true },
        ],
        availability: avail({
          1: { '2026-11-16': [[600, 660, 2]] },
          2: { '2026-11-16': [[600, 660, 2]] },
          3: { '2026-11-17': [[720, 780, 2]] },
        }),
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ start: '2026-11-17T12:00', free: [3], busy: [1, 2] });
  });

  it('при равенстве баллов — более раннее время, окна не пересекаются', () => {
    const r = suggest(base({ availability: avail({ 1: { '2026-11-16': [[600, 780, 2]] } }) }));
    expect(r.map((s) => s.start)).toEqual([
      '2026-11-16T10:00',
      '2026-11-16T11:00',
      '2026-11-16T12:00',
    ]);
  });

  it('пустой результат, если никто не отметился или встреча не помещается', () => {
    expect(suggest(base({}))).toEqual([]);
    expect(
      suggest(
        base({ durationMin: 240, availability: avail({ 1: { '2026-11-16': [[600, 780, 2]] } }) }),
      ),
    ).toEqual([]);
  });
});
