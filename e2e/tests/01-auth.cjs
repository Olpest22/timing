const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  const B = (process.env.E2E_BASE || 'http://localhost:5173') + '';
  const email = `petya${Date.now()}@test.ru`;

  // 1. Защищённая страница без входа → /login
  await p.goto(B + '/dashboard');
  await p.waitForURL('**/login'); console.log('1 redirect to login ok');

  // 2. Регистрация: ошибки полей
  await p.click('text=Зарегистрироваться');
  await p.fill('#name', 'П'); await p.fill('#email', 'bad'); await p.fill('#password', '123'); await p.fill('#confirm', '123');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Некорректный email');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/register-errors.png' }); console.log('2 field errors ok');

  // 3. Пароли не совпадают
  await p.fill('#name', 'Петя'); await p.fill('#email', email); await p.fill('#password', 'secret1'); await p.fill('#confirm', 'secret2');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Пароли не совпадают'); console.log('3 confirm mismatch ok');

  // 4. Успешная регистрация → кабинет
  await p.fill('#confirm', 'secret1');
  await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard');
  await p.waitForSelector('header >> text=Петя');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/dashboard.png' }); console.log('4 register ok');

  // 5. Перезагрузка сохраняет сессию; /login уводит в кабинет
  await p.reload(); await p.waitForSelector('header >> text=Петя');
  await p.goto(B + '/login'); await p.waitForURL('**/dashboard'); console.log('5 session persists ok');

  // 6. Выход
  await p.click('text=Выйти'); await p.waitForURL(B + '/');
  await p.waitForSelector('text=Создать аккаунт'); console.log('6 logout ok');

  // 7. Неверный пароль
  await p.goto(B + '/login');
  await p.fill('#email', email); await p.fill('#password', 'wrong');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Неверный email или пароль');
  await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/login-error.png' }); console.log('7 wrong password ok');

  // 8. Вход (email в другом регистре)
  await p.fill('#email', email.toUpperCase()); await p.fill('#password', 'secret1');
  await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard'); console.log('8 login ok');

  // 9. Протухший токен → выкидывает на /login
  await p.evaluate(() => localStorage.setItem('timing.token', 'garbage'));
  await p.goto(B + '/dashboard'); await p.waitForURL('**/login');
  assert.strictEqual(await p.evaluate(() => localStorage.getItem('timing.token')), null);
  console.log('9 invalid token cleared ok');

  // 10. Мобильная ширина
  await p.setViewportSize({ width: 375, height: 700 });
  await p.goto(B + '/register'); await p.screenshot({ path: require('path').join(__dirname, '..', 'screenshots') + '/register-mobile.png' });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.strictEqual(overflow, false); console.log('10 mobile no overflow ok');
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
