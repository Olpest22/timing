const { chromium } = require('playwright');
const assert = require('assert');
const B = (process.env.E2E_BASE || 'http://localhost:5173') + '';
(async () => {
  const b = await chromium.launch();
  const t = Date.now();
  // ── Аня регистрируется и создаёт мероприятие
  const ca = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await ca.newPage();
  await a.goto(B + '/register');
  await a.fill('#name', 'Аня'); await a.fill('#email', `anya${t}@t.ru`); await a.fill('#password', 'secret1'); await a.fill('#confirm', 'secret1');
  await a.click('button[type=submit]'); await a.waitForURL('**/dashboard');
  await a.waitForSelector('text=Создайте мероприятие и разошлите ссылку');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-dash-empty.png' });
  await a.click('a:has-text("Создать мероприятие")'); await a.waitForURL('**/events/new');
  // ошибка: пустое название и конец дня раньше начала
  await a.selectOption('#dayEnd', '09:00');
  await a.waitForSelector('text=Проверьте даты и часы');
  await a.click('button[type=submit]');
  await a.waitForSelector('text=Название — минимум 2 символа');
  await a.waitForSelector('text=Конец дня должен быть позже начала');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-new-errors.png', fullPage: true }); console.log('1 validation ok');
  await a.fill('#title', 'Ретро спринта');
  await a.fill('#description', 'Обсудим, что получилось за спринт.\nВозьмите ноутбуки.');
  await a.selectOption('#dayEnd', '19:00');
  await a.selectOption('#durationMin', '120');
  const summary = await a.locator('[aria-live=polite]').innerText(); console.log('summary:', summary);
  assert.match(summary, /по 18 клеток в день/);
  await a.click('label:has-text("60 мин")');
  assert.match(await a.locator('[aria-live=polite]').innerText(), /по 9 клеток/);
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-new.png', fullPage: true });
  await a.click('button[type=submit]'); await a.waitForURL(/\/e\/[a-z0-9]{8}$/);
  const url = a.url(); console.log('2 created', url);
  await a.waitForSelector('text=Мероприятие создано — разошлите ссылку');
  await a.click('button:has-text("Копировать")'); await a.waitForTimeout(200);
  assert.equal(await a.evaluate(() => navigator.clipboard.readText()), url); console.log('3 copy ok');
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-event-owner.png', fullPage: true });

  // ── Петя без аккаунта открывает ссылку
  const cb = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await cb.newPage();
  await p.goto(url);
  await p.waitForSelector('text=Аня зовёт вас');
  assert.equal(await p.locator('text=Участники').count(), 0); // список скрыт от не-участников
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-event-guest.png', fullPage: true }); console.log('4 guest view ok');
  await p.click('a:has-text("Создать аккаунт")'); await p.waitForURL('**/register');
  await p.fill('#name', 'Петя'); await p.fill('#email', `petya${t}@t.ru`); await p.fill('#password', 'secret1'); await p.fill('#confirm', 'secret1');
  await p.click('button[type=submit]'); await p.waitForURL(url); console.log('5 returned to event after register ok');
  await p.click('button:has-text("Присоединиться")');
  await p.waitForSelector('text=Участники');
  await p.waitForSelector('text=отметили 0 из 2'); console.log('6 joined ok');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-event-joined-m.png', fullPage: true });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  // ── Аня видит Петю и мероприятие в кабинете
  await a.reload(); await a.waitForSelector('li:has-text("Петя")');
  await a.goto(B + '/dashboard'); await a.waitForSelector('text=Ретро спринта');
  assert.match(await a.locator('section[aria-labelledby=slot-waiting]').innerText(), /отметили 0\/2/);
  assert.match(await a.locator('h1 + p').innerText(), /1\s+мероприятие ждёт вашей отметки/);
  await a.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/s2-dash.png' }); console.log('7 dashboard ok');

  // ── 404
  await a.goto(B + '/e/nonexist'); await a.waitForSelector('text=Мероприятие не найдено'); console.log('8 404 ok');
  // ── вход по ссылке через «Войти» тоже возвращает назад
  const cc = await b.newContext(); const c = await cc.newPage();
  await c.goto(url); await c.click('a:has-text("Войти")'); await c.waitForURL('**/login');
  await c.fill('#email', `petya${t}@t.ru`); await c.fill('#password', 'secret1'); await c.click('button[type=submit]');
  await c.waitForURL(url); await c.waitForSelector('text=Участники'); console.log('9 login returns to event ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
