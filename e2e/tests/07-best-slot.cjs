const { chromium } = require('playwright');
const assert = require('assert');
const B = (process.env.E2E_BASE || 'http://localhost:5173') + '', A = (process.env.E2E_API || 'http://localhost:3000/api') + '';
const req = (method, url, body, token) => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) }).then((r) => r.json());
const slots = (day, from, to, level = 2) => { const out = []; for (let m = from * 60; m < to * 60; m += 30) out.push({ start: `2026-11-${day}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, level }); return out; };
(async () => {
  const t = Date.now();
  const [anya, petya, oleg, masha] = await Promise.all(['Аня', 'Петя', 'Олег', 'Маша'].map((n, i) => req('POST', A + '/auth/register', { name: n, email: `v${i}${t}@t.ru`, password: 'secret1' })));
  const { event } = await req('POST', A + '/events', { title: 'Ретро спринта', dateFrom: '2026-11-16', dateTo: '2026-11-20', dayStart: '10:00', dayEnd: '19:00', durationMin: 120, slotStepMin: 30 }, anya.token);
  for (const u of [petya, oleg, masha]) await req('POST', `${A}/events/${event.code}/join`, {}, u.token);
  // Вт 16–19: Аня, Петя, Олег; Чт 12–14: Аня, Маша; Пн 10–12: Олег, Маша
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [...slots(17, 16, 19), ...slots(19, 12, 14)] }, anya.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: slots(17, 16, 19) }, petya.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [...slots(17, 16, 19), ...slots(16, 10, 12)] }, oleg.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [...slots(19, 12, 14), ...slots(16, 10, 12)] }, masha.token);
  const url = `${B}/e/${event.code}`;
  const b = await chromium.launch();
  const open = async (token) => { const c = await b.newContext({ viewport: { width: 1280, height: 1300 } }); const p = await c.newPage(); await p.goto(B); await p.evaluate((tk) => localStorage.setItem('timing.token', tk), token); await p.goto(url); return p; };

  const a = await open(anya.token);
  await a.waitForSelector('#best-title');
  const cards = a.locator('section[aria-labelledby=best-title] li button');
  assert.equal(await cards.count(), 3);
  const first = await cards.nth(0).innerText(); console.log('   #1:', first.replace(/\n/g, ' | '));
  assert.match(first, /Вт, 17 нояб\. 16:00–18:00/); assert.match(first, /свободны 3 из 4/); assert.match(first, /не могут: Маша/);
  assert.equal(await a.locator('[data-frame]').count(), 1); console.log('1 suggestions + frame ok');
  const f1 = await a.locator('[data-frame]').boundingBox();
  await cards.nth(1).click();
  assert.equal(await cards.nth(1).getAttribute('aria-pressed'), 'true');
  const f2 = await a.locator('[data-frame]').boundingBox();
  assert.notDeepEqual([f1.x, f1.y], [f2.x, f2.y]); console.log('2 pick moves frame ok');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s5-best.png' });
  // Маша обязательная → вторник отпадает
  await a.click('button[aria-label="Маша: сделать обязательным"]');
  await a.waitForSelector('button[aria-label="Маша: сделать необязательным"]');
  await a.waitForFunction(() => !document.querySelector('section[aria-labelledby=best-title]').innerText.includes('17 нояб.'));
  const firstReq = await cards.nth(0).innerText(); console.log('   #1 with required:', firstReq.replace(/\n/g, ' | '));
  assert.match(firstReq, /свободны 2 из 4/); console.log('3 required participant filters ok');
  await a.click('button[aria-label="Маша: сделать необязательным"]');
  await a.waitForFunction(() => document.querySelector('section[aria-labelledby=best-title]').innerText.includes('17 нояб.'));

  // Петя: не организатор, ставит «если очень надо» на среду
  const p = await open(petya.token);
  await p.waitForSelector('#best-title');
  assert.equal(await p.locator('button:has-text("Назначить")').count(), 0);
  await p.waitForSelector('text=Время назначает организатор: Аня');
  assert.equal(await p.locator('button[aria-label$="сделать обязательным"]').count(), 0); console.log('4 participant view ok');
  await p.click('#tab-mine'); await p.click('[role=radio]:has-text("Если очень надо")');
  const c1 = await p.locator('#panel-mine [data-cell="2026-11-18T10:00"]').boundingBox();
  const c2 = await p.locator('#panel-mine [data-cell="2026-11-18T11:30"]').boundingBox();
  await p.mouse.move(c1.x + 5, c1.y + 5); await p.mouse.down(); await p.mouse.move(c2.x + 5, c2.y + 5, { steps: 4 }); await p.mouse.up();
  await p.waitForSelector('text=если очень надо: 2 ч'); await p.waitForSelector('text=Сохранено');
  assert.match(await p.getAttribute('#panel-mine [data-cell="2026-11-18T10:30"]', 'aria-label'), /если очень надо/);
  await p.waitForTimeout(500); await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s5-maybe.png' }); console.log('5 maybe brush ok');
  await a.reload(); await a.waitForSelector('#panel-team [role=grid]');
  await a.hover('#panel-team [data-cell="2026-11-18T10:30"]');
  assert.match(await a.locator('#panel-team .bg-ink').innerText(), /если очень надо: Петя/); console.log('6 maybe in heat tooltip ok');

  // Аня назначает первый вариант
  await a.click('section[aria-labelledby=best-title] li:first-child button');
  await a.click('button:has-text("Назначить: вторник, 17 ноября, 16:00–18:00")');
  await a.waitForSelector('text=Время назначено');
  assert.equal(await a.locator('[role=tablist]').count(), 0);
  assert.equal(await a.locator('[data-frame]').count(), 1);
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s5-final.png' }); console.log('7 finalize ok');
  await a.goto(B + '/dashboard'); await a.waitForSelector('section[aria-labelledby=slot-scheduled] >> text=вторник, 17 ноября, 16:00–18:00');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s5-dash.png' }); console.log('8 dashboard scheduled ok');
  await p.reload(); await p.waitForSelector('text=Время назначено');
  assert.equal(await p.locator('button:has-text("Вернуть к выбору")').count(), 0); console.log('9 participant sees final, cannot reopen ok');
  await a.goto(url); await a.click('button:has-text("Вернуть к выбору")'); await a.waitForSelector('[role=tablist]'); console.log('10 reopen ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
