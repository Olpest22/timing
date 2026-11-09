const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
const B = (process.env.E2E_BASE || 'http://localhost:5173') + '', A = (process.env.E2E_API || 'http://localhost:3000/api') + '';
const req = (method, url, body, token) => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) }).then((r) => r.json());
(async () => {
  const t = Date.now();
  const [anya, petya] = await Promise.all(['Аня', 'Петя'].map((n, i) => req('POST', A + '/auth/register', { name: n, email: `w${i}${t}@t.ru`, password: 'secret1' })));
  const { event } = await req('POST', A + '/events', { title: 'Ретро спринта', dateFrom: '2026-11-16', dateTo: '2026-11-20', dayStart: '10:00', dayEnd: '19:00', durationMin: 60, slotStepMin: 30, timezone: 'Europe/Moscow', deadline: '2026-11-14' }, anya.token);
  await req('POST', `${A}/events/${event.code}/join`, {}, petya.token);
  await req('PUT', `${A}/events/${event.code}/availability`, { slots: [{ start: '2026-11-17T16:00' }, { start: '2026-11-17T16:30' }] }, anya.token);
  const url = `${B}/e/${event.code}`;
  const b = await chromium.launch();
  const open = async (token, opts = {}) => { const c = await b.newContext({ viewport: { width: 1280, height: 1300 }, acceptDownloads: true, ...opts }); const p = await c.newPage(); await p.goto(B); if (token) await p.evaluate((tk) => localStorage.setItem('timing.token', tk), token); await p.goto(url); return p; };

  const a = await open(anya.token);
  await a.waitForSelector('#panel-team [role=grid]');
  assert.match(await a.locator('dl').innerText(), /Отметить до\s+14 ноября, осталось \d+ дн/);
  assert.match(await a.locator('dl').innerText(), /Москва \(GMT\+3\)/); console.log('1 deadline + timezone in card ok');
  assert.match(await a.getAttribute('#panel-team [data-cell="2026-11-17T16:00"]', 'class'), /bg-heat-4/); // 1 из 2
  const p = await open(petya.token, { timezoneId: 'Asia/Yekaterinburg' });
  await p.waitForSelector('#panel-mine [role=grid]');
  const tzNote = await p.locator('text=У вас другой часовой пояс').innerText(); console.log('   tz note:', tzNote);
  assert.match(tzNote, /10:00 в табеле — это 12:00 у вас \(\+2 ч\)/); console.log('2 timezone notice ok');
  // Петя отмечает — у Ани карта меняется без перезагрузки
  await p.click('#panel-mine [data-cell="2026-11-17T16:00"]'); await p.waitForSelector('text=Сохранено');
  await a.waitForFunction(() => document.querySelector('#tab-team').innerText.includes('2/2'), null, { timeout: 5000 });
  await a.waitForFunction(() => /bg-heat-7/.test(document.querySelector('#panel-team [data-cell="2026-11-17T16:00"]').className), null, { timeout: 5000 });
  console.log('3 live heatmap update ok');
  // Правка названия — у Пети обновляется само
  await req('PATCH', `${A}/events/${event.code}`, { title: 'Ретро спринта № 12' }, anya.token);
  await p.waitForSelector('#event-title:has-text("Ретро спринта № 12")', { timeout: 5000 }); console.log('4 live details update ok');
  // Гость по ссылке
  const g = await open(null);
  await g.waitForSelector('text=Как вас зовут');
  await g.fill('#guestName', 'Гость Олег'); await g.click('button:has-text("Отметить своё время")');
  await g.waitForSelector('#panel-mine [role=grid]');
  await a.waitForSelector('li:has-text("Гость Олег")', { timeout: 5000 }); console.log('5 guest join + live participants ok');
  g.once('dialog', (d) => { console.log('   confirm:', d.message()); d.dismiss(); });
  await g.click('button:has-text("Выйти")'); await g.waitForTimeout(300);
  assert.equal(new URL(g.url()).pathname, `/e/${event.code}`); console.log('6 guest logout asks first ok');
  // Назначение — у Пети само появляется «Время назначено», календарь скачивается
  await req('POST', `${A}/events/${event.code}/finalize`, { start: '2026-11-17T16:00' }, anya.token);
  await p.waitForSelector('text=Время назначено', { timeout: 5000 }); console.log('7 live finalize ok');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a:has-text("Добавить в календарь")')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(ics, /DTSTART:20261117T130000Z/); assert.match(ics, /SUMMARY:Ретро спринта № 12/); console.log('8 ics download ok:', dl.suggestedFilename());
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s6-final-tz.png' });
  // Удаление через страницу правки — у Пети «Мероприятие удалено»
  await a.goto(url + '/edit'); await a.waitForSelector('text=Изменить мероприятие');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s6-edit.png', fullPage: true });
  await a.click('section[aria-labelledby=danger-title] button:has-text("Удалить")');
  await a.waitForSelector('dialog[open]'); await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s6-confirm.png' });
  await a.click('button:has-text("Удалить навсегда")'); await a.waitForURL('**/dashboard');
  await p.waitForSelector('text=Мероприятие удалено', { timeout: 5000 }); console.log('9 delete + live deleted ok');
  // Форма создания: пояс по умолчанию — браузерный, срок
  const n = await (await b.newContext({ viewport: { width: 1280, height: 1100 }, timezoneId: 'Asia/Vladivostok' })).newPage();
  await n.goto(B); await n.evaluate((tk) => localStorage.setItem('timing.token', tk), anya.token); await n.goto(B + '/events/new');
  assert.equal(await n.inputValue('#timezone'), 'Asia/Vladivostok');
  await n.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s6-new.png', fullPage: true }); console.log('10 new form tz default ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
