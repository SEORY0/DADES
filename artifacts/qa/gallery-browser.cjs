const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.DADES_PLAYWRIGHT_PATH || 'playwright');

const origin = process.env.DADES_TEST_ORIGIN || 'http://localhost:4173';
const evidence = process.env.DADES_QA_OUTPUT || '/tmp/dades-gallery-qa/final';
const report = { checks: [], routes: [], captures: [], errors: [] };

function check(condition, label) {
  assert.ok(condition, label);
  report.checks.push(label);
}

async function capture(page, name, fullPage = false) {
  const file = path.join(evidence, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: 'disabled' });
  report.captures.push(file);
}

async function htmlRoutes(dir, prefix = '') {
  const routes = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) routes.push(...await htmlRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    else if (entry.name === 'index.html') routes.push(`${prefix}/`);
    else if (entry.name.endsWith('.html')) routes.push(`${prefix}/${entry.name}`);
  }
  return routes;
}

async function waitForImages(page) {
  await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      image.scrollIntoView({ block: 'center', inline: 'nearest' });
      if ('decode' in image) {
        try {
          await image.decode();
        } catch {}
      }
    }));
  });
}

async function columnCount(page) {
  return page.locator('[data-issue-card]:visible').evaluateAll((cards) => {
    const tops = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)));
    const firstTop = Math.min(...tops);
    return cards.filter((card) => Math.round(card.getBoundingClientRect().top) === firstTop).length;
  });
}

(async () => {
  await fs.mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    const expectedResourceNoise = text.includes('Failed to load resource') && page.url().includes('/404');
    if (message.type() === 'error' && !expectedResourceNoise) report.errors.push(text);
  });

  try {
    report.routes = await htmlRoutes(path.resolve('dist'));
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const route of report.routes) {
        const response = await page.goto(`${origin}/DADES${route}`, { waitUntil: 'networkidle' });
        const status = response?.status() ?? 0;
        check((status > 0 && status < 400) || (route === '/404.html' && status === 404), `${width} ${route}: loads`);
        await page.evaluate(() => document.fonts.ready);
        await waitForImages(page);
        for (const reveal of await page.locator('[data-reveal]').all()) await reveal.scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, 0));
        const dimensions = await page.evaluate(() => ({ view: innerWidth, scroll: document.documentElement.scrollWidth }));
        check(dimensions.scroll <= dimensions.view, `${width} ${route}: no horizontal overflow`);
        const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
          const ids = elements.map((element) => element.id);
          return ids.filter((id, index) => ids.indexOf(id) !== index);
        });
        check(duplicateIds.length === 0, `${width} ${route}: unique IDs`);
        const brokenImages = await page.locator('img').evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src));
        check(brokenImages.length === 0, `${width} ${route}: no broken images`);
        await capture(page, `${width}-${route.replace(/[^a-z0-9]+/gi, '-') || 'home'}`, true);
      }
      console.log(`Captured ${report.routes.length} routes at ${width}px`);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    check(await page.locator('[data-issue-card]').count() === 6, 'home renders six issue cards');
    check(await page.locator('[data-issue-link]').count() === 6, 'each issue card has a link');
    check(await columnCount(page) === 3, 'desktop gallery has three columns');
    await capture(page, 'home-desktop-gallery');
    report.nav = await page.locator('.nav-shell').evaluate((el) => { const rect = el.getBoundingClientRect(); const css = getComputedStyle(el); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: css.borderRadius, backdrop: css.backdropFilter }; });

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    check(await columnCount(page) === 2, 'tablet gallery has two columns');
    await capture(page, 'home-tablet-gallery');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    check(await columnCount(page) === 1, 'mobile gallery has one column');
    await page.locator('[data-menu-toggle]').click();
    check(await page.locator('[data-mobile-menu]').getAttribute('aria-hidden') === 'false', 'mobile menu still opens');
    await page.keyboard.press('Escape');
    check(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'false', 'mobile menu still closes with Escape');
    await capture(page, 'home-mobile-gallery');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    const securityCard = page.locator('[data-issue-card][data-topic="security"]').first();
    const securityTitle = ((await securityCard.locator('h2').textContent()) ?? '').trim();
    const securityHref = (await securityCard.locator('[data-issue-link]').getAttribute('href')) ?? '';
    const securityIssue = securityHref.match(/\/issues\/(\d+)\//)?.[1];
    check(Boolean(securityTitle && securityIssue), 'QA found a security issue card');

    await page.goto(`${origin}/DADES/?topic=security&q=${encodeURIComponent(securityTitle)}`, { waitUntil: 'networkidle' });
    check(await page.locator('[data-gallery-filter="security"]').getAttribute('aria-pressed') === 'true', 'security filter restores from URL');
    check(await page.locator('[data-gallery-query]').inputValue() === securityTitle, 'search query restores from URL');
    check(await page.locator('[data-issue-card]:visible').count() === 1, 'filter and search combine');
    check((await page.locator('[data-issue-link]:visible').first().getAttribute('href')).includes('topic=security'), 'card link carries gallery topic');
    check((await page.locator('[data-issue-link]:visible').first().getAttribute('href')).includes('q='), 'card link carries gallery query');
    await capture(page, 'home-filter-security-query');

    await page.locator('[data-gallery-query]').fill('zzzz-empty');
    check(await page.locator('[data-gallery-empty]').isVisible(), 'empty state appears');
    await page.locator('[data-gallery-reset]').click();
    check(await page.locator('[data-issue-card]:visible').count() === 6, 'reset restores all cards');
    check(await page.locator('[data-gallery-filter="all"]').getAttribute('aria-pressed') === 'true', 'reset restores all filter');

    await page.goto(`${origin}/DADES/?topic=security&q=${encodeURIComponent(securityTitle)}`, { waitUntil: 'networkidle' });
    await page.locator('[data-issue-link]:visible').first().click();
    await page.waitForURL(new RegExp(`/DADES/issues/${securityIssue}/\\?topic=security&q=`));
    check(await page.locator('.entry').count() === 3, 'issue detail renders three entries for sample issue');
    check(await page.locator('[data-clip-id]').count() === 3, 'issue detail keeps clipping controls');
    const savedTitle = ((await page.locator('.entry-title').first().textContent()) ?? '').trim();
    await page.locator('[data-clip-id]').first().click();
    check(await page.locator('[data-clip-id]').first().getAttribute('aria-pressed') === 'true', 'issue detail clip button saves');
    await page.goto(`${origin}/DADES/clippings/`, { waitUntil: 'networkidle' });
    check(await page.locator('main').getByText(savedTitle, { exact: true }).count() > 0, 'saved sample issue item appears in scrapbook');
    await page.goBack({ waitUntil: 'networkidle' });
    check((await page.locator('[data-gallery-back]').getAttribute('href')).includes('/DADES/?topic=security'), 'detail back link preserves filter');
    await page.locator('[data-gallery-back]').click();
    await page.waitForURL(/\/DADES\/\?topic=security&q=/);
    check(await page.locator('[data-issue-card]:visible').count() === 1, 'back link restores filtered gallery');
    await page.goBack({ waitUntil: 'networkidle' });
    check(page.url().includes(`/DADES/issues/${securityIssue}/?topic=security`), 'browser back returns to filtered detail');
    await page.goForward({ waitUntil: 'networkidle' });
    check(await page.locator('[data-issue-card]:visible').count() === 1, 'browser forward restores filtered gallery');

    await page.goto(`${origin}/DADES/?topic=nope&q=MCP`, { waitUntil: 'networkidle' });
    check(await page.locator('[data-gallery-filter="all"]').getAttribute('aria-pressed') === 'true', 'invalid topic normalizes to all');
    check(!new URL(page.url()).searchParams.has('topic'), 'invalid topic removed from URL');

    await page.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    for (let i = 0; i < 30; i += 1) {
      const onCard = await page.evaluate(() => document.activeElement?.matches('[data-issue-link]') ?? false);
      if (onCard) break;
      await page.keyboard.press('Tab');
    }
    check(await page.evaluate(() => document.activeElement?.matches('[data-issue-link]') ?? false), 'keyboard can focus an issue card link');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/DADES\/issues\/\d+\//);
    check(await page.locator('.entry').count() > 0, 'Enter opens the focused issue');

    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const plain = await nojs.newPage();
    await plain.goto(`${origin}/DADES/`, { waitUntil: 'networkidle' });
    check(await plain.locator('[data-issue-card]:visible').count() === 6, 'no-JS homepage shows all issue cards');
    check(!await plain.locator('[data-gallery-toolbar]').isVisible(), 'no-JS toolbar remains hidden');
    await plain.screenshot({ path: path.join(evidence, 'home-nojs-mobile.png'), fullPage: true, animations: 'disabled' });
    report.captures.push(path.join(evidence, 'home-nojs-mobile.png'));
    await nojs.close();

    check(report.errors.length === 0, `no runtime console errors: ${report.errors.join('; ')}`);
  } finally {
    await fs.writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log(JSON.stringify({ routes: report.routes.length, captures: report.captures.length, checks: report.checks.length, errors: report.errors }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
