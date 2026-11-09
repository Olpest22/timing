const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const email = `pal${Date.now()}@t.ru`;
  // Браузер 1: гость выбирает «Чернила», регистрируется — палитра уходит в профиль
  const c1 = await b.newContext(); const p = await c1.newPage();
  await p.goto((process.env.E2E_BASE || 'http://localhost:5173') + '/');
  await p.click('button[aria-haspopup=menu]'); await p.click('[role=menuitemradio]:has-text("Чернила")');
  await p.goto((process.env.E2E_BASE || 'http://localhost:5173') + '/register');
  await p.fill('#name', 'Палитра'); await p.fill('#email', email); await p.fill('#password', 'secret1'); await p.fill('#confirm', 'secret1');
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'ink'); console.log('1 guest choice saved on register ok');
  // меняет на «День» уже вошедшим
  await p.click('button[aria-haspopup=menu]'); await p.click('[role=menuitemradio]:has-text("День")'); await p.waitForTimeout(500);
  // Браузер 2: чистый, входит — получает «День» из профиля
  const c2 = await b.newContext(); const q = await c2.newPage();
  await q.goto((process.env.E2E_BASE || 'http://localhost:5173') + '/login');
  assert.equal(await q.evaluate(() => document.documentElement.dataset.theme ?? 'graphite'), 'graphite');
  await q.fill('#email', email); await q.fill('#password', 'secret1'); await q.click('button[type=submit]');
  await q.waitForURL('**/dashboard'); await q.waitForTimeout(300);
  assert.equal(await q.evaluate(() => document.documentElement.dataset.theme), 'day'); console.log('2 theme follows account to other browser ok');
  await q.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/th-dash-day.png' });
  // «Графит» снимает атрибут
  await q.click('button[aria-haspopup=menu]'); await q.click('[role=menuitemradio]:has-text("Графит")'); await q.waitForTimeout(300);
  assert.equal(await q.evaluate(() => document.documentElement.hasAttribute('data-theme')), false); console.log('3 graphite = default ok');
  // Esc закрывает меню и возвращает фокус
  await q.click('button[aria-haspopup=menu]'); await q.keyboard.press('Escape');
  assert.equal(await q.evaluate(() => document.querySelector('#theme-menu').matches(':popover-open')), false); console.log('4 esc closes ok');
  await b.close(); console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
