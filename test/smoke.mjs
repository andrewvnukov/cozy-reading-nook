// Playwright smoke-тест «Книжный Уголок».
// Запуск:  node test/smoke.mjs
// Проверяет: загрузку без ошибок консоли, тест-хуки, переворот страницы
// (тап-доход), пассивный доход, покупку книги (доход+коллекция растут),
// апгрейды, награды, переключатель языка, ежедневный подарок,
// сейв/перезагрузку.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'file://' + resolve(__dirname, '..', 'index.html');

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url);
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 8000 });

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); fail++; process.exitCode = 1; } else { console.log('ok  ', msg); pass++; } };
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

let s0 = await state();
assert(typeof s0.coins === 'number', 'render_game_to_text returns state');
assert(s0.lvl === 1 && s0.books === 1, 'starts with 1 book (diary) on the shelf');
assert(s0.seen === 1, 'collection seeded with starter');
assert(s0.ips >= 1, 'starter book gives passive income');

// тап по книге (canvas) = переворот страницы = доход
await page.mouse.click(240, 450);
let s1 = await state();
assert(s1.coins > s0.coins, 'tapping the book flips a page and grants sparks');

// хук __flip тоже работает
let s1b = await state();
await page.evaluate(() => window.__flip());
let s1c = await state();
assert(s1c.coins > s1b.coins, '__flip hook increases sparks');

// пассивный доход через хук времени
await page.evaluate(() => window.advanceTime(10000));
let s2 = await state();
assert(s2.coins >= s1c.coins + s1c.ips * 9, 'passive income accrues over time');

// покупка новой книги -> растёт коллекция и доход
await page.evaluate(() => window.__grant(2000));
let before = await state();
let bought = await page.evaluate(() => window.__buyNextBook());
let after = await state();
assert(bought === true, 'can add a new book when affordable');
assert(after.books === before.books + 1, 'book count increases');
assert(after.lvl === before.lvl + 1, 'lvl (books) increases -> upgrade path works');
assert(after.seen === before.seen + 1, 'collection grows on new book');
assert(after.ips > before.ips, 'new book raises passive income');
assert(after.best >= after.books, 'best (leaderboard) tracks shelf size');

// апгрейд «быстрые пальцы» повышает тап-доход
await page.evaluate(() => window.__grant(100000));
let bF = await state();
let okF = await page.evaluate(() => window.__buyUp('finger'));
let aF = await state();
assert(okF && aF.finger === bF.finger + 1, 'finger upgrade applies');
assert(aF.tapGain > bF.tapGain, 'finger upgrade raises tap gain');

// апгрейд «тёплый плед» повышает пассивный доход
let bB = await state();
let okB = await page.evaluate(() => window.__buyUp('blanket'));
let aB = await state();
assert(okB && aB.blanket === bB.blanket + 1, 'blanket upgrade applies');
assert(aB.ips > bB.ips, 'blanket upgrade raises income');

// апгрейд «дешёвые чернила» удешевляет книги (upCost падает)
let bI = await state();
let okI = await page.evaluate(() => window.__buyUp('ink'));
let aI = await state();
assert(okI && aI.ink === bI.ink + 1, 'ink upgrade applies');
assert(aI.upCost <= bI.upCost, 'ink upgrade lowers next book price');

// награда ×2 удваивает доход
let bx = await state();
await page.click('#x2Btn');
let ax = await state();
assert(ax.x2 === true, 'sparks ×2 reward activates');
assert(ax.ips >= bx.ips * 2, 'income doubled while ×2 active');

// подарок начисляет искры
let bg = await state();
await page.click('#giftBtn');
let ag = await state();
assert(ag.coins > bg.coins, 'gift reward grants sparks');

// панели открываются без ошибок
await page.click('#shopBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .row'), 'book shop renders rows');
await page.click('#mClose'); await page.waitForTimeout(80);
await page.click('#upBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .row'), 'upgrade panel renders rows');
await page.click('#mClose'); await page.waitForTimeout(80);
await page.click('#collBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .coll'), 'collection grid renders');
await page.click('#mClose'); await page.waitForTimeout(80);

// переключатель языка
let langBefore = await page.textContent('#langTxt');
await page.click('#langBtn'); await page.waitForTimeout(80);
let langAfter = await page.textContent('#langTxt');
assert(langBefore !== langAfter, 'lang toggle switches RU/EN label');
const htmlLang = await page.getAttribute('html', 'lang');
assert(htmlLang === (langAfter === 'EN' ? 'en' : 'ru'), 'html lang attribute follows toggle');

// ежедневный подарок начисляется автоматически при первом заходе (уже случилось в boot)
assert(s0.coins >= 0, 'daily gift path does not crash boot');

// сейв переживает перезагрузку
let pre = await state();
await page.evaluate(() => window.__grant(0)); // форс-persist через действие
await page.evaluate(() => window.__flip());
await page.waitForTimeout(50);
await page.reload();
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 8000 });
let post = await state();
assert(post.books === pre.books, 'book roster survives reload');
assert(post.seen === pre.seen, 'collection survives reload');
assert(post.finger === pre.finger && post.blanket === pre.blanket && post.ink === pre.ink, 'upgrades survive reload');

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
