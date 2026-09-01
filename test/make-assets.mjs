// Headless-генерация магазинных ассетов (без внешних image-API).
// Делает: скриншоты геймплея с реального билда + обложки RU/EN + иконку из card.html.
// Запуск из папки игры:  node test/make-assets.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const out = resolve(root, 'store-assets');
mkdirSync(out, { recursive: true });
const gameUrl = 'file://' + resolve(root, 'index.html');
const cardUrl = 'file://' + resolve(root, 'store', 'card.html');

// ---- CONFIG ----
const HERO = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
  + '<g stroke="#4A3323" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">'
  + '<path d="M50 30 C40 22 24 22 16 27 L16 74 C24 69 40 69 50 77 Z" fill="#E8955A"/>'   // левая страница
  + '<path d="M50 30 C60 22 76 22 84 27 L84 74 C76 69 60 69 50 77 Z" fill="#F2C88A"/>'   // правая страница
  + '</g>'
  + '<path d="M50 30 L50 77" stroke="#4A3323" stroke-width="3" stroke-linecap="round"/>'
  + '<g stroke="rgba(74,51,35,.45)" stroke-width="2" stroke-linecap="round">'
  + '<path d="M22 38h20M22 46h20M22 54h16M58 38h20M58 46h20M58 54h16"/>'
  + '</g>'
  + '<g fill="#F2C14E" stroke="#4A3323" stroke-width="2.4" stroke-linejoin="round">'
  + '<path d="M50 8l3.4 8.6L62 20l-8.6 3.4L50 32l-3.4-8.6L38 20l8.6-3.4z"/>'
  + '</g>'
  + '</svg>';
const CONFIG = {
  titleRu: 'Книжный Уголок', titleEn: 'Cozy Reading Nook',
  subRu: 'Читай книги · собери библиотеку', subEn: 'Turn pages · build your library',
  heroSvg: HERO,
  accent: '#E8955A', bg: '#2B1E17', ink: '#4A3323',
  // характерные экраны: [имя файла, скрипт подготовки состояния через хуки]
  shots: [
    ['d1-start',       async p => { for(let i=0;i<8;i++){ await p.evaluate(()=>window.__flip()); await p.waitForTimeout(60); } }],
    ['d2-reading',     async p => { await p.evaluate(()=>window.__grant(30000));
                                    for(let i=0;i<3;i++) await p.evaluate(()=>window.__buyNextBook());
                                    await p.evaluate(()=>window.__flip()); }],
    ['d3-shop',        async p => { await p.evaluate(()=>{ window.__grant(80000); }); await p.click('#shopBtn'); }],
    ['d4-upgrades',    async p => { await p.evaluate(()=>window.__grant(250000)); await p.click('#upBtn'); }],
    ['d5-collection',  async p => { await p.evaluate(()=>window.__grant(400000));
                                    for(let i=0;i<6;i++) await p.evaluate(()=>window.__buyNextBook());
                                    await p.click('#collBtn'); }],
  ],
};

const browser = await chromium.launch();

async function shot(url, w, h, file, prep, locale) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale });
  await page.goto(url);
  await page.waitForTimeout(500);
  if (prep) await prep(page);
  await page.waitForTimeout(350);
  // скрыть активный тост, чтобы не перекрывал кадр (без анимации — сразу opacity 0)
  await page.evaluate(() => { const t = document.getElementById('toast'); if (t) { t.classList.remove('on'); t.style.transition = 'none'; t.style.opacity = '0'; } });
  await page.waitForTimeout(50);
  await page.screenshot({ path: resolve(out, file) });
  await page.close();
  console.log('saved', file);
}

// Скриншоты геймплея (десктоп 1920x1080) — RU и EN локали (авто-язык через navigator.language)
for (const [name, prep] of CONFIG.shots) {
  await shot(gameUrl, 1920, 1080, name + '.png',    prep, 'ru-RU');
  await shot(gameUrl, 1920, 1080, name + '-en.png', prep, 'en-US');
}

// Обложки 800x470 и иконка 512x512 из card.html
const card = (o) => cardUrl + '?' + new URLSearchParams(o).toString();
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleRu,sub:CONFIG.subRu,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover.png');
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleEn,sub:CONFIG.subEn,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover-en.png');
await shot(card({ w:512,h:512,mode:'icon',heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 512, 512, 'icon.png');

await browser.close();
console.log('\nАссеты готовы в', out);
