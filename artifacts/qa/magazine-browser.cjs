const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.DADES_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.DADES_TEST_ORIGIN || 'http://localhost:4173';
const evidence = process.env.DADES_QA_OUTPUT || '/tmp/dades-magazine-qa/final';
const report = { routes: [], checks: [], errors: [], captures: [] };
const check = (condition, label) => { assert.ok(condition, label); report.checks.push(label); };
async function capture(page, name, fullPage = false) {
  const file = path.join(evidence, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.captures.push(file);
}
async function htmlRoutes(dir, prefix = '') {
  const routes = [];
  for (const file of await fs.readdir(dir, { withFileTypes: true })) {
    if (file.isDirectory()) routes.push(...await htmlRoutes(path.join(dir, file.name), `${prefix}/${file.name}`));
    else if (file.name === 'index.html') routes.push(`${prefix}/`);
    else if (file.name.endsWith('.html')) routes.push(`${prefix}/${file.name}`);
  }
  return routes;
}
(async () => {
  await fs.mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  try {
    report.routes = await htmlRoutes(path.resolve('dist'));
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const route of report.routes) {
        const response = await page.goto(`${origin}/DADES${route}`, { waitUntil: 'networkidle' });
        check(response.status() === 200 || route === '/404.html' && response.status() === 404, `${width} ${route}: loads`);
        await page.evaluate(() => document.fonts.ready);
        for (const reveal of await page.locator('[data-reveal]').all()) await reveal.scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, 0));
        const dimensions = await page.evaluate(() => ({ view: innerWidth, scroll: document.documentElement.scrollWidth }));
        check(dimensions.scroll <= dimensions.view, `${width} ${route}: no horizontal overflow`);
        const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
          const ids = elements.map((element) => element.id);
          return ids.filter((id, index) => ids.indexOf(id) !== index);
        });
        check(duplicateIds.length === 0, `${width} ${route}: unique IDs (${duplicateIds})`);
        const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src));
        check(brokenImages.length === 0, `${width} ${route}: no broken loaded images`);
        await capture(page, `${width}-${route.replace(/[^a-z0-9]+/gi, '-') || 'home'}`, true);
      }
      console.log(`Captured ${report.routes.length} routes at ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    const nav = await page.locator('.nav-shell').evaluate((element) => {
      const rect = element.getBoundingClientRect(); const css = getComputedStyle(element);
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: css.borderRadius, backdrop: css.backdropFilter };
    });
    const baseline = JSON.parse(await fs.readFile('/tmp/dades-magazine-qa/nav-baseline.json', 'utf8'));
    assert.deepEqual(nav, baseline); report.checks.push('Desktop navigation geometry exactly matches baseline');
    await capture(page, 'home-desktop-first');
    const allCount = await page.locator('[data-issue-story]:visible').count();
    check(allCount > 0, 'Homepage has articles');
    await page.locator('[data-story-filter="agents"]').click();
    check(await page.locator('[data-issue-story]:visible').count() === 1, 'Agent filter matches current issue');
    check(await page.locator('[data-story-count]').textContent() === '1', 'Filter count is announced');
    await capture(page, 'filter-agents');
    await page.locator('[data-story-filter="security"]').click();
    check(await page.locator('[data-story-empty]').isVisible(), 'Security filter empty state is visible');
    check(await page.locator('[data-issue-story]:visible').count() === 0, 'Security filter excludes unrelated articles');
    await capture(page, 'filter-empty');
    await page.locator('[data-story-reset]').click();
    check(await page.locator('[data-issue-story]:visible').count() === allCount, 'Reset restores articles');
    check(await page.locator('[data-story-filter="all"]').evaluate((el) => el === document.activeElement), 'Reset restores keyboard focus');
    await page.goto(`${origin}/DADES/subscribe/`, { waitUntil: 'networkidle' });
    await page.locator('[data-copy-rss]').click();
    check((await page.evaluate(() => navigator.clipboard.readText())).endsWith('/DADES/rss.xml'), 'RSS copy puts the actual feed URL on clipboard');
    check((await page.locator('[data-copy-status]').textContent()).includes('복사했습니다'), 'RSS copy announces success');
    await page.goto(`${origin}/DADES/partner/`, { waitUntil: 'networkidle' });
    const mail = await page.locator('a[href^="mailto:"]').first().getAttribute('href');
    check(mail.startsWith('mailto:dades.mag@gmail.com?'), 'Partnership enquiry uses the provided email');
    await page.goto(`${origin}/DADES/issues/1/`, { waitUntil: 'networkidle' });
    await page.locator('[data-clip-id]').first().click();
    check(await page.locator('[data-clip-id]').first().getAttribute('aria-pressed') === 'true', 'Article saves to scrapbook');
    await page.goto(`${origin}/DADES/clippings/`, { waitUntil: 'networkidle' });
    check(await page.locator('main').getByText('AI가 설계한 CPU가 둠을 성공적으로 실행', { exact: true }).count() > 0, 'Saved article appears in scrapbook');
    await page.goto(`${origin}/DADES/archive/`, { waitUntil: 'networkidle' });
    await page.locator('.pagefind-ui__search-input').fill('MCP');
    await page.waitForSelector('.pagefind-ui__result');
    check(await page.locator('.pagefind-ui__result').count() > 0, 'Archive search returns MCP results');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    await capture(page, 'home-mobile-first');
    await page.locator('[data-menu-toggle]').click();
    check(await page.locator('[data-mobile-menu]').getAttribute('aria-hidden') === 'false', 'Mobile menu opens');
    await capture(page, 'mobile-menu-open');
    await page.keyboard.press('Escape');
    check(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'false', 'Escape closes mobile menu');
    check(await page.locator('[data-menu-toggle]').evaluate((el) => el === document.activeElement), 'Mobile menu returns focus');
    await page.locator('[data-set-theme="ink"]').click();
    await page.reload({ waitUntil: 'networkidle' });
    check(await page.locator('html').getAttribute('data-theme') === 'ink', 'Ink theme persists after reload');
    await capture(page, 'home-mobile-ink', true);
    await page.locator('[data-set-theme="paper"]').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.emulateMedia({ media: 'print' });
    check(await page.locator('[data-issue-story]:visible').count() === allCount, 'Print preserves all articles');
    await page.emulateMedia({ media: 'screen' });
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const plain = await nojs.newPage();
    await plain.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    check(await plain.locator('[data-issue-story]:visible').count() === allCount, 'All articles visible without JavaScript');
    check(!await plain.locator('[data-story-toolbar]').isVisible(), 'Unusable filters absent without JavaScript');
    await nojs.close();
    check(report.errors.length === 0, `No runtime/console errors: ${report.errors.join('; ')}`);
  } finally {
    await fs.writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ routes: report.routes.length, captures: report.captures.length, checks: report.checks.length, errors: report.errors }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
