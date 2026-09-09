const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { chromium } = require('/home/seory0/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const origin = process.env.DADES_TEST_ORIGIN ?? 'http://127.0.0.1:4321';
const out = path.join(__dirname, 'status-v2');
mkdirSync(out, { recursive: true });
const jobs = [
  { theme: 'ink', width: 1440, height: 1000, metric: 'intelligence' },
  { theme: 'ink', width: 1440, height: 1000, metric: 'coding' },
  { theme: 'ink', width: 390, height: 844, metric: 'intelligence' },
  { theme: 'white', width: 1440, height: 1000, metric: 'intelligence' },
  { theme: 'white', width: 390, height: 844, metric: 'intelligence' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  for (const job of jobs) {
    const context = await browser.newContext({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1, isMobile: job.width < 810, reducedMotion: 'reduce' });
    await context.addInitScript((theme) => localStorage.setItem('dades:theme', theme), job.theme);
    const page = await context.newPage();
    const suffix = job.metric === 'intelligence' ? '' : `?metric=${job.metric}`;
    await page.goto(`${origin}/DADES/status/${suffix}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.model-board.has-board-js');
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((node) => node.classList.add('is-revealed')));
    await page.waitForTimeout(800);
    const file = path.join(out, `status-${job.theme}-${job.width}${job.metric === 'intelligence' ? '' : `-${job.metric}`}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('saved', file);
    await context.close();
  }
  await browser.close();
})();
