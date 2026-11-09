import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics.js';
import { tzOffsetMinutes, wallToUtc } from './tz.js';

describe('часовые пояса', () => {
  it('настенное время в UTC', () => {
    expect(wallToUtc('2026-11-17T16:00', 'Europe/Moscow').toISOString()).toBe(
      '2026-11-17T13:00:00.000Z',
    );
    expect(wallToUtc('2026-11-17T16:00', 'Asia/Yekaterinburg').toISOString()).toBe(
      '2026-11-17T11:00:00.000Z',
    );
  });
  it('учитывает летнее время', () => {
    expect(tzOffsetMinutes(Date.parse('2026-07-01T12:00:00Z'), 'Europe/Berlin')).toBe(120);
    expect(tzOffsetMinutes(Date.parse('2026-12-01T12:00:00Z'), 'Europe/Berlin')).toBe(60);
    expect(wallToUtc('2026-03-29T03:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-03-29T01:30:00.000Z',
    );
  });
});

describe('ics', () => {
  const ics = buildIcs({
    uid: 'abc@timing',
    title: 'Ретро спринта; итоги, планы',
    description: 'Строка 1\nСтрока 2',
    url: 'http://localhost:5173/e/abc',
    start: new Date('2026-11-17T13:00:00Z'),
    end: new Date('2026-11-17T15:00:00Z'),
  });
  it('время в UTC и экранирование', () => {
    expect(ics).toContain('DTSTART:20261117T130000Z');
    expect(ics).toContain('DTEND:20261117T150000Z');
    expect(ics).toContain('SUMMARY:Ретро спринта\\; итоги\\, планы');
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
