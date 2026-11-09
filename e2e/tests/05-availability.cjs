const { chromium } = require('playwright');
const assert = require('assert');
const B = (process.env.E2E_BASE || 'http://localhost:5173') + '', A = (process.env.E2E_API || 'http://localhost:3000/api') + '';
const post = (url, body, token) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) }).then((r) => r.json());
(async () => {
  const t = Date.now();
  // Подготовка через API: Аня создаёт мероприятие, Петя присоединяется
  const anya = await post(A + '/auth/register', { name: 'Аня', email: `a${t}@t.ru`, password: 'secret1' });
  const petya = await post(A + '/auth/register', { name: 'Петя', email: `p${t}@t.ru`, password: 'secret1' });
  const { event } = await post(A + '/events', { title: 'Ретро спринта', dateFrom: '2026-11-16', dateTo: '2026-11-20', dayStart: '10:00', dayEnd: '19:00', durationMin: 60, slotStepMin: 30 }, anya.token);
  await post(`${A}/events/${event.code}/join`, {}, petya.token);
  const url = `${B}/e/${event.code}`;
  const b = await chromium.launch();
  const login = async (ctx, token) => { const p = await ctx.newPage(); await p.goto(B); await p.evaluate((tk) => localStorage.setItem('timing.token', tk), token); return p; };

  // ── Петя на десктопе
  const cp = await b.newContext({ viewport: { width: 1280, height: 1300 } });
  const p = await login(cp, petya.token);
  await p.goto(url); await p.waitForSelector('text=Отметьте, когда вы свободны');
  // протягивание: вторник 16:00 → 18:30
  const a1 = await p.locator('#panel-mine [data-cell="2026-11-17T16:00"]').boundingBox();
  const a2 = await p.locator('#panel-mine [data-cell="2026-11-17T18:30"]').boundingBox();
  await p.mouse.move(a1.x + 5, a1.y + 5); await p.mouse.down();
  for (let y = a1.y + 5; y <= a2.y + 5; y += 6) await p.mouse.move(a1.x + 5, y);
  await p.mouse.move(a2.x + 5, a2.y + 5); await p.mouse.up();
  assert.equal(await p.locator('#panel-mine [role=gridcell][aria-pressed=true]').count(), 6);
  await p.waitForSelector('text=Сохранено'); console.log('1 drag + autosave ok');
  assert.match(await p.locator('text=Вы свободны').innerText(), /3 ч/);
  // весь день — четверг
  await p.click('button[aria-label^="Отметить весь день: четверг"]');
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-19"][aria-pressed=true]').count(), 18);
  await p.click('button[aria-label^="Снять весь день: четверг"]');
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-19"][aria-pressed=true]').count(), 0); console.log('2 whole day toggle ok');
  // клавиатура: фокус в сетку, вправо-вниз, пробел
  await p.focus('#panel-mine [data-cell="2026-11-16T10:00"]'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Space');
  assert.equal(await p.getAttribute('#panel-mine [data-cell="2026-11-17T10:30"]', 'aria-pressed'), 'true'); console.log('3 keyboard ok');
  await p.waitForSelector('text=Сохранено'); await p.waitForTimeout(300);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s3-grid.png', fullPage: true });
  // после перезагрузки всё на месте
  await p.reload(); await p.click('#tab-mine'); await p.waitForSelector('#panel-mine [role=grid]');
  const saved = await p.$$eval('#panel-mine [role=gridcell][aria-pressed=true]', (els) => els.map((e) => e.dataset.cell));
  assert.deepEqual(saved.sort(), ['2026-11-17T10:30', '2026-11-17T16:00', '2026-11-17T16:30', '2026-11-17T17:00', '2026-11-17T17:30', '2026-11-17T18:00', '2026-11-17T18:30'].sort());
  console.log('4 persisted after reload ok');
  // сбой сети: отметка остаётся, показывается ошибка и «Повторить»
  await p.route('**/availability', (route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
  await p.click('#panel-mine [data-cell="2026-11-18T12:00"]');
  await p.waitForSelector('text=Не сохранилось');
  assert.equal(await p.getAttribute('#panel-mine [data-cell="2026-11-18T12:00"]', 'aria-pressed'), 'true');
  await p.unroute('**/availability'); await p.click('button:has-text("Повторить")'); await p.waitForSelector('text=Сохранено'); console.log('5 save error + retry ok');
  // прямоугольник: Ср 12:30 → Пт 13:30 (3 дня × 3 клетки)
  const r1 = await p.locator('#panel-mine [data-cell="2026-11-18T12:30"]').boundingBox();
  const r2 = await p.locator('#panel-mine [data-cell="2026-11-20T13:30"]').boundingBox();
  await p.mouse.move(r1.x + 5, r1.y + 5); await p.mouse.down(); await p.mouse.move(r2.x + 5, r2.y + 5, { steps: 4 }); await p.mouse.up();
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-19"][aria-pressed=true]').count(), 3);
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-20"][aria-pressed=true]').count(), 3); console.log('5a rectangle ok');
  // ручка: тянем низ отрезка Вт 16:00–19:00 вверх до 17:00 включительно
  await p.hover('#panel-mine [data-cell="2026-11-17T17:00"]');
  const hb = await p.locator('[data-handle=bottom]').boundingBox();
  const tgt = await p.locator('#panel-mine [data-cell="2026-11-17T17:00"]').boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
  await p.mouse.move(hb.x + hb.width / 2, tgt.y + tgt.height / 2, { steps: 5 }); await p.mouse.up();
  const tue = await p.$$eval('#panel-mine [data-cell^="2026-11-17T1"][aria-pressed=true]', (els) => els.map((e) => e.dataset.cell.slice(11)));
  assert.deepEqual(tue, ['10:30', '16:00', '16:30', '17:00']); console.log('5b resize handle ok');
  // крестик на наведённом отрезке
  await p.hover('#panel-mine [data-cell="2026-11-18T12:30"]');
  await p.click('button[aria-label="Удалить отрезок 12:00–14:00"]');
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-18"][aria-pressed=true]').count(), 0); console.log('5c delete × ok');
  // Delete с клавиатуры
  await p.focus('#panel-mine [data-cell="2026-11-19T13:00"]'); await p.keyboard.press('Delete');
  assert.equal(await p.locator('#panel-mine [data-cell^="2026-11-19"][aria-pressed=true]').count(), 0); console.log('5d delete key ok');
  // Очистить → Вернуть
  const before = await p.locator('#panel-mine [role=gridcell][aria-pressed=true]').count();
  await p.click('button:has-text("Очистить")'); assert.equal(await p.locator('#panel-mine [role=gridcell][aria-pressed=true]').count(), 0);
  await p.click('button:has-text("Вернуть")'); assert.equal(await p.locator('#panel-mine [role=gridcell][aria-pressed=true]').count(), before); console.log('5e clear + undo ok');
  await p.waitForSelector('text=Сохранено');
  await p.hover('#panel-mine [data-cell="2026-11-17T16:30"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s3b-desktop.png' });


  // ── Аня видит, что Петя отметился
  const ca = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await login(ca, anya.token);
  await a.goto(url); await a.waitForSelector('text=отметили 1 из 2');
  assert.match(await a.locator('li:has-text("Петя")').innerText(), /время отмечено/);
  await a.goto(B + '/dashboard'); await a.waitForSelector('text=отметили 1/2'); console.log('6 organizer sees response ok');

  // ── Телефон: касание переключает клетку, страница не шире экрана
  const cm = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await login(cm, anya.token);
  await m.goto(url); await m.waitForSelector('[role=grid]');
  await m.tap('#panel-mine [data-cell="2026-11-16T10:00"]');
  await m.waitForSelector('text=Нажмите, где отрезок заканчивается');
  assert.equal(await m.getAttribute('#panel-mine [data-cell="2026-11-16T10:00"]', 'aria-pressed'), 'false');
  await m.tap('#panel-mine [data-cell="2026-11-16T11:00"]');
  for (const c of ['10:00', '10:30', '11:00']) assert.equal(await m.getAttribute(`#panel-mine [data-cell="2026-11-16T${c}"]`, 'aria-pressed'), 'true');
  // касание отрезка → крестик удаляет
  await m.tap('#panel-mine [data-cell="2026-11-16T10:30"]');
  await m.tap('button[aria-label="Удалить отрезок 10:00–11:30"]');
  assert.equal(await m.locator('#panel-mine [data-cell^="2026-11-16"][aria-pressed=true]').count(), 0);
  await m.tap('#panel-mine [data-cell="2026-11-16T10:00"]'); await m.tap('#panel-mine [data-cell="2026-11-16T10:00"]');
  assert.equal(await m.getAttribute('#panel-mine [data-cell="2026-11-16T10:00"]', 'aria-pressed'), 'true');
  await m.waitForSelector('text=Сохранено');
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); console.log('7 mobile tap ok');
  await m.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s3-mobile.png', fullPage: true });

  // ── Большое мероприятие: 31 день, шаг 15 мин — горизонтальная прокрутка внутри карточки
  const big = await post(A + '/events', { title: 'Отпуск', dateFrom: '2026-12-01', dateTo: '2026-12-31', dayStart: '08:00', dayEnd: '22:00', durationMin: 60, slotStepMin: 15 }, anya.token);
  await p.evaluate((tk) => localStorage.setItem('timing.token', tk), anya.token);
  await p.goto(`${B}/e/${big.event.code}`); await p.waitForSelector('[role=grid]');
  assert.equal(await p.locator('#panel-mine [role=gridcell]').count(), 31 * 56);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s3-big.png' }); console.log('8 big grid ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
