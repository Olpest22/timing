const { chromium } = require('playwright');
const assert = require('assert');
const B = (process.env.E2E_BASE || 'http://localhost:5173') + '', A = (process.env.E2E_API || 'http://localhost:3000/api') + '';
const req = (method, url, body, token) => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) }).then((r) => r.json());
const slots = (day, from, to) => { const out = []; for (let m = from * 60; m < to * 60; m += 30) out.push({ start: `2026-11-${day}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }); return out; };
(async () => {
  const t = Date.now();
  const [anya, petya, oleg, masha] = await Promise.all(['Аня', 'Петя', 'Олег', 'Маша'].map((n, i) => req('POST', A + '/auth/register', { name: n, email: `u${i}${t}@t.ru`, password: 'secret1' })));
  const { event } = await req('POST', A + '/events', { title: 'Ретро спринта', dateFrom: '2026-11-16', dateTo: '2026-11-20', dayStart: '10:00', dayEnd: '19:00', durationMin: 60, slotStepMin: 30 }, anya.token);
  for (const u of [petya, oleg, masha]) await req('POST', `${A}/events/${event.code}/join`, {}, u.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [...slots(17, 16, 19), ...slots(19, 12, 14)] }, anya.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [...slots(17, 15, 18), ...slots(19, 10, 13)] }, petya.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: slots(17, 17, 19) }, oleg.token);
  const url = `${B}/e/${event.code}`;
  const b = await chromium.launch();
  const open = async (token, vp = { width: 1280, height: 1000 }) => { const c = await b.newContext({ viewport: vp }); const p = await c.newPage(); await p.goto(B); await p.evaluate((tk) => localStorage.setItem('timing.token', tk), token); await p.goto(url); return p; };

  const p = await open(anya.token);
  await p.waitForSelector('#panel-team:not([hidden]) [role=grid]');
  assert.equal(await p.getAttribute('#tab-team', 'aria-selected'), 'true'); console.log('1 responded → team tab by default ok');
  assert.match(await p.locator('#tab-team').innerText(), /3\/4/);
  const cls = (k) => p.getAttribute(`#panel-team [data-cell="${k}"]`, 'class');
  assert.match(await cls('2026-11-17T17:00'), /bg-heat-5/); // 3 из 4 → ступень 5
  assert.match(await cls('2026-11-17T15:00'), /bg-heat-2/); // 1 из 4 → ступень 2
  assert.match(await cls('2026-11-16T10:00'), /bg-heat-0/); console.log('2 heat levels ok');
  await p.hover('#panel-team [data-cell="2026-11-17T17:00"]');
  const tip = await p.locator('#panel-team .bg-ink').innerText(); console.log('   tip:', tip.replace(/\n/g, ' | '));
  assert.match(tip, /свободны 3 из 4/); assert.match(tip, /может: Аня, Петя и Олег/); assert.match(tip, /не могут: Маша/); console.log('3 tooltip names ok');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s4-team.png' });
  // выбор участника
  await p.click('button[aria-label^="Петя:"]');
  assert.match(await cls('2026-11-19T10:00'), /bg-signal/);
  assert.match(await cls('2026-11-17T18:00'), /bg-heat-0/);
  await p.waitForSelector('text=Петя может');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s4-spot.png' });
  await p.click('button[aria-label^="Петя:"]');
  assert.match(await cls('2026-11-17T17:00'), /bg-heat-5/); console.log('4 spotlight on/off ok');
  // своя сетка с подсказкой команды и новой отметкой
  await p.click('#tab-mine'); await p.waitForSelector('#panel-mine:not([hidden]) [role=grid]');
  await p.click('[role=switch]');
  const bg = await p.$eval('#panel-mine [data-cell="2026-11-19T10:00"]', (e) => e.style.background);
  assert.match(bg, /color-mix/); console.log('5 team hint on my grid ok');
  await p.waitForTimeout(600); console.log('   switch:', await p.$eval('[role=switch]', (e) => [e.getAttribute('aria-checked'), getComputedStyle(e).backgroundColor, getComputedStyle(e, '::after').left])); await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s4-mine-hint.png' });
  const c1 = await p.locator('#panel-mine [data-cell="2026-11-19T10:00"]').boundingBox();
  const c2 = await p.locator('#panel-mine [data-cell="2026-11-19T11:30"]').boundingBox();
  await p.mouse.move(c1.x + 5, c1.y + 5); await p.mouse.down(); await p.mouse.move(c2.x + 5, c2.y + 5, { steps: 3 }); await p.mouse.up();
  await p.waitForSelector('text=Сохранено'); await p.waitForTimeout(500);
  await p.click('#tab-team');
  assert.match(await cls('2026-11-19T10:00'), /bg-heat-4/); console.log('6 map refreshed after own save ok'); // 2 из 4
  // клавиатура по вкладкам
  await p.focus('#tab-team'); await p.keyboard.press('ArrowLeft');
  assert.equal(await p.getAttribute('#tab-mine', 'aria-selected'), 'true'); console.log('7 tabs by arrows ok');
  // Маша ещё не отметилась → открывается «Моё время»
  const m = await open(masha.token, { width: 390, height: 844 });
  await m.waitForSelector('#panel-mine:not([hidden]) [role=grid]');
  assert.equal(await m.getAttribute('#tab-mine', 'aria-selected'), 'true');
  await m.click('#tab-team'); await m.waitForSelector('#panel-team:not([hidden]) [role=grid]');
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await m.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s4-mobile.png', fullPage: true }); console.log('8 not responded → mine tab, mobile ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
