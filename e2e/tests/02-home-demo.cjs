const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  await p.goto((process.env.E2E_BASE || 'http://localhost:5173') + '/');
  const best = () => p.locator('[aria-live=polite]').innerText();
  console.log('start:', (await best()).replace(/\n/g, ' | '));
  // клик мышью по Чт 17:00 → вы свободны
  await p.click('[data-cell="3-17"]');
  assert.equal(await p.getAttribute('[data-cell="3-17"]', 'aria-pressed'), 'true');
  // повторный клик снимает
  await p.click('[data-cell="3-17"]');
  assert.equal(await p.getAttribute('[data-cell="3-17"]', 'aria-pressed'), 'false');
  // протягивание мышью Пт 16 → 19
  const a = await p.locator('[data-cell="4-16"]').boundingBox();
  const z = await p.locator('[data-cell="4-19"]').boundingBox();
  await p.mouse.move(a.x + 10, a.y + 10); await p.mouse.down();
  for (let y = a.y + 10; y <= z.y + 10; y += 8) await p.mouse.move(a.x + 10, y);
  await p.mouse.move(z.x + 10, z.y + 10);
  await p.mouse.up();
  const painted = await p.$$eval('[data-cell^="4-"][aria-pressed=true]', (els) => els.map((e) => e.dataset.cell));
  console.log('painted:', painted.join(','));
  assert.deepEqual(painted, ['4-16', '4-17', '4-18', '4-19']);
  // клавиатура: фокус, стрелки, пробел
  await p.focus('[data-cell="4-19"]');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  const f = await p.evaluate(() => document.activeElement.dataset.cell);
  assert.equal(f, '3-17');
  await p.keyboard.press('Space'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  const thu = await p.$$eval('[data-cell^="3-"][aria-pressed=true]', (els) => els.map((e) => e.dataset.cell));
  assert.deepEqual(thu, ['3-17', '3-18']);
  console.log('after keyboard:', (await best()).replace(/\n/g, ' | '));
  assert.match(await best(), /свободны 6 из 7, не могут Олег/);
  console.log('label:', await p.getAttribute('[data-cell="3-17"]', 'aria-label'));
  // tab-порядок: в сетке ровно одна клетка с tabindex=0
  assert.equal(await p.locator('[role=gridcell][tabindex="0"]').count(), 1);
  await p.locator('section[aria-labelledby=card-title]').screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/demo-after.png' });
  // касание: tap переключает, без «рисования»
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.goto((process.env.E2E_BASE || 'http://localhost:5173') + '/');
  await m.tap('[data-cell="0-10"]');
  assert.equal(await m.getAttribute('[data-cell="0-10"]', 'aria-pressed'), 'true');
  console.log('touch tap ok');
  await b.close();
  console.log('ALL OK');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
