const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('/home/seory0/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const baseUrl = 'http://127.0.0.1:4321/DADES';
const evidenceDir = path.resolve(__dirname, 'current');

const routes = [
  ['home', '/'],
  ['404', '/404.html'],
  ['about', '/about/'],
  ['archive', '/archive/'],
  ['archive-agents', '/archive/agents/'],
  ['archive-browser-agents', '/archive/browser-agents/'],
  ['archive-culture', '/archive/culture/'],
  ['archive-efficiency', '/archive/efficiency/'],
  ['archive-evals', '/archive/evals/'],
  ['archive-hardware', '/archive/hardware/'],
  ['archive-mcp', '/archive/mcp/'],
  ['archive-open-source', '/archive/open-source/'],
  ['archive-prompt-engineering', '/archive/prompt-engineering/'],
  ['archive-research', '/archive/research/'],
  ['clippings', '/clippings/'],
  ['inbox', '/inbox/'],
  ['issue-1', '/issues/1/'],
  ['status', '/status/'],
  ['wiki', '/wiki/'],
  ['wiki-agent', '/wiki/agent/'],
  ['wiki-context-window', '/wiki/context-window/'],
  ['wiki-harness', '/wiki/harness/'],
  ['wiki-lethal-trifecta', '/wiki/lethal-trifecta/'],
  ['wiki-mcp', '/wiki/mcp/'],
  ['wiki-prompt', '/wiki/prompt/'],
  ['wiki-prompt-injection', '/wiki/prompt-injection/'],
  ['wiki-token', '/wiki/token/'],
];

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routeCount: routes.length,
  captures: [],
  assertions: [],
  consoleErrors: [],
  pageErrors: [],
};

function assert(condition, message, detail = undefined) {
  report.assertions.push({ passed: Boolean(condition), message, detail });
  if (!condition) throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
}

async function attachDiagnostics(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push({ label, text: message.text() });
  });
  page.on('pageerror', (error) => report.pageErrors.push({ label, text: error.message }));
}

async function capture(page, name, options = {}) {
  if (options.revealAll) {
    await page.evaluate(() => {
      document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-revealed'));
    });
  }
  const file = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({
    path: file,
    fullPage: options.fullPage ?? false,
    animations: options.animations ?? 'disabled',
  });
  const dimensions = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
  }));
  report.captures.push({ name, file, ...dimensions, fullPage: options.fullPage ?? false });
}

async function auditViewport(browser, viewportName, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await attachDiagnostics(page, viewportName);

  for (const [name, route] of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    const expectedStatus = 200;
    assert(response?.status() === expectedStatus, `${viewportName}/${name} returns ${expectedStatus}`, response?.status());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${viewportName}/${name} has no horizontal overflow`, overflow);
    await capture(page, `${viewportName}--${name}--full`, { fullPage: true, revealAll: true });
  }

  await context.close();
}

async function auditProgressiveEnhancement(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();

  for (const [name, route] of [
    ['home', '/'],
    ['status', '/status/'],
    ['issue', '/issues/1/'],
    ['wiki-article', '/wiki/agent/'],
  ]) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    assert(response?.status() === 200, `no-JS/${name} returns 200`, response?.status());
    const revealState = await page.locator('[data-reveal]').evaluateAll((elements) => ({
      count: elements.length,
      hidden: elements.filter((element) => Number.parseFloat(getComputedStyle(element).opacity) < 0.99).length,
    }));
    assert(revealState.count > 0 && revealState.hidden === 0, `no-JS/${name} keeps editorial content visible`, revealState);
  }

  await context.close();
}

async function auditResponsiveHome(browser) {
  const viewportCases = [
    ['desktop', { width: 1440, height: 1000 }],
    ['tablet', { width: 768, height: 1024 }],
    ['mobile', { width: 390, height: 844 }],
  ];

  for (const [name, viewport] of viewportCases) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await context.newPage();
    await attachDiagnostics(page, `home-${name}`);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await capture(page, `home-${name}--rest`);

    const homeMetrics = await page.evaluate(() => {
      const coverAction = document.querySelector('.current-cover-action')?.getBoundingClientRect();
      return {
        publication: document.querySelector('[data-magazine-nameplate] h1')?.textContent?.trim(),
        cover: document.querySelector('[data-current-cover]') !== null,
        coverActionTop: coverAction?.top,
        storyCount: document.querySelectorAll('[data-issue-story]').length,
        snap: getComputedStyle(document.documentElement).scrollSnapType,
      };
    });
    assert(homeMetrics.publication === 'DADES', `${name} exposes the publication nameplate`, homeMetrics);
    assert(homeMetrics.cover, `${name} exposes the current issue cover`, homeMetrics);
    assert(homeMetrics.storyCount === 5, `${name} exposes all five current stories`, homeMetrics);
    assert(homeMetrics.snap === 'none', `${name} uses normal document scrolling`, homeMetrics);
    assert(
      typeof homeMetrics.coverActionTop === 'number' && homeMetrics.coverActionTop < viewport.height,
      `${name} exposes the primary issue action in the first viewport`,
      homeMetrics,
    );

    const desktopNavVisible = await page.locator('.site-nav').isVisible();
    const menuToggleVisible = await page.locator('[data-menu-toggle]').isVisible();
    if (name === 'desktop') {
      assert(desktopNavVisible && !menuToggleVisible, 'desktop uses capsule navigation');
      const chromeMetrics = await page.locator('.nav-shell').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const fill = getComputedStyle(element.querySelector('.glass-fill-layer'));
        return {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          radius: style.borderRadius,
          blur: style.backdropFilter,
          fill: fill.backgroundColor,
        };
      });
      assert(Math.abs(chromeMetrics.width - 663.42) < 1, 'desktop glass width matches Recent measurement', chromeMetrics);
      assert(Math.abs(chromeMetrics.height - 46.2) < 1, 'desktop glass height matches Recent measurement', chromeMetrics);
      assert(Math.abs(chromeMetrics.top - 30) < 1, 'desktop glass top offset matches Recent measurement', chromeMetrics);
      assert(chromeMetrics.radius === '30px', 'desktop glass radius matches Recent measurement', chromeMetrics);
      assert(chromeMetrics.blur.includes('9px'), 'desktop glass uses measured 9px backdrop blur', chromeMetrics);
      assert(chromeMetrics.fill === 'rgba(212, 215, 222, 0.7)', 'desktop glass uses measured live fill', chromeMetrics);

      const navLink = page.locator('.site-nav a').first();
      await navLink.hover();
      await page.waitForTimeout(80);
      await capture(page, 'home-desktop--nav-hover-mid', { animations: 'allow' });
      await page.waitForTimeout(320);
      await capture(page, 'home-desktop--nav-hover-settled');

      const navCta = page.locator('.nav-cta');
      await navCta.hover();
      await page.waitForTimeout(220);
      const ctaState = await navCta.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      });
      assert(ctaState.background === 'rgb(18, 20, 22)', 'desktop CTA inverts to ink on hover', ctaState);
      await capture(page, 'home-desktop--cta-hover');

      const coverImage = page.locator('.current-cover-art img');
      const coverBefore = await coverImage.evaluate((image) => getComputedStyle(image).transform);
      await page.locator('.current-cover-art').hover();
      await page.waitForTimeout(80);
      await capture(page, 'home-desktop--cover-hover-mid', { animations: 'allow' });
      await page.waitForTimeout(320);
      const coverAfter = await coverImage.evaluate((image) => getComputedStyle(image).transform);
      assert(coverBefore !== coverAfter, 'current issue cover signals its linked state on hover', { coverBefore, coverAfter });
      await capture(page, 'home-desktop--cover-hover-settled');
    } else {
      assert(!desktopNavVisible && menuToggleVisible, `${name} uses compact menu control`);
    }

    for (const story of await page.locator('[data-issue-story]').all()) {
      await story.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
    }
    assert(
      await page.locator('[data-issue-story] img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
      `${name} loads every current-story image as the reader reaches it`,
    );
    assert(
      await page.locator('.issue-contents [data-reveal].is-revealed').count() > 0,
      `${name} reveals the issue contents in document order`,
    );
    await capture(page, `home-${name}--contents`);

    await page.locator('.editorial-guide').scrollIntoViewIfNeeded();
    await page.waitForTimeout(620);
    assert(
      await page.locator('.editorial-guide [data-reveal].is-revealed').count() > 0,
      `${name} reveals the editor note and department index`,
    );
    await capture(page, `home-${name}--editorial-guide`);

    await capture(page, `home-${name}--full`, { fullPage: true, revealAll: true });

    await context.close();
  }
}

async function auditInteractions(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await attachDiagnostics(page, 'interactions');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4321' });

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await capture(page, 'mobile-menu--rest');
  await page.locator('[data-menu-toggle]').click();
  await page.waitForTimeout(80);
  await capture(page, 'mobile-menu--mid', { animations: 'allow' });
  await page.waitForTimeout(360);
  await capture(page, 'mobile-menu--settled');
  assert(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'true', 'mobile menu reports open state');
  assert(await page.locator('[data-mobile-menu]').getAttribute('aria-hidden') === 'false', 'mobile menu is exposed to assistive technology');
  assert(await page.evaluate(() => document.activeElement?.hasAttribute('data-menu-first')), 'mobile menu moves focus to first item');
  assert(await page.locator('[data-menu-toggle]').getAttribute('aria-label') === '메뉴 닫기', 'mobile menu control announces close action');
  const mobileGeometry = await page.evaluate(() => {
    const dock = document.querySelector('.nav-shell')?.getBoundingClientRect();
    const panel = document.querySelector('[data-mobile-menu]')?.getBoundingClientRect();
    return dock && panel ? {
      dock: { width: dock.width, height: dock.height, top: dock.top, bottom: dock.bottom },
      panel: { width: panel.width, height: panel.height, top: panel.top, bottom: panel.bottom },
    } : null;
  });
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.dock.width - 350) < 1, 'mobile dock matches Recent 350px width', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.dock.height - 42.3) < 1, 'mobile dock matches Recent 42.3px height', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.dock.top - 771.7) < 1, 'mobile dock matches Recent 30px bottom offset', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.panel.width - 350) < 1, 'mobile menu matches Recent 350px width', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.panel.height - 343.3) < 1, 'mobile menu matches Recent 343.3px panel height', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.panel.top - 470.7) < 1, 'mobile menu starts at Recent measured position', mobileGeometry);
  assert(Boolean(mobileGeometry) && Math.abs(mobileGeometry.panel.bottom - mobileGeometry.dock.bottom) < 1, 'mobile menu and dock form one aligned glass system', mobileGeometry);

  await page.keyboard.press('Escape');
  assert(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'false', 'Escape closes mobile menu');
  await page.locator('[data-menu-toggle]').click();
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  assert(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'false', 'outside click closes mobile menu');

  await page.locator('.theme-swatch[data-set-theme="ink"]').click();
  assert(await page.locator('html').getAttribute('data-theme') === 'ink', 'theme control applies ink mode');
  assert(await page.evaluate(() => localStorage.getItem('dades:theme')) === 'ink', 'theme choice persists');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  assert(await page.locator('html').getAttribute('data-theme') === 'ink', 'persisted theme survives reload');
  await page.locator('.theme-swatch[data-set-theme="paper"]').click();

  await page.evaluate(() => localStorage.removeItem('dades:clips:v1'));
  await page.goto(`${baseUrl}/issues/1/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const firstClip = page.locator('.clip-btn[data-clip-id]').first();
  await firstClip.click();
  assert(await firstClip.getAttribute('aria-pressed') === 'true', 'clip button exposes saved state');
  assert(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dades:clips:v1') ?? '{}')).length) === 1, 'clip payload persists');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  assert(await page.locator('.clip-btn[data-clip-id]').first().getAttribute('aria-pressed') === 'true', 'clip state survives reload');
  await page.locator('.clip-btn[data-clip-id]').first().click();
  assert(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('dades:clips:v1') ?? '{}')).length) === 0, 'clip can be removed');

  await page.evaluate(() => localStorage.removeItem('dades:interests:v1'));
  await page.goto(`${baseUrl}/archive/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.waitForSelector('[data-index-search]:not([hidden])', { timeout: 5000 });
  const searchInput = page.locator('.pagefind-ui__search-input');
  await searchInput.fill('MCP');
  await page.waitForTimeout(480);
  assert(await page.locator('.pagefind-ui__result').count() > 0, 'Pagefind returns live archive results');
  await capture(page, 'archive-search--mcp');
  const firstInterest = page.locator('.interest-btn[data-interest-tag]').first();
  const interestTag = await firstInterest.getAttribute('data-interest-tag');
  await firstInterest.click();
  assert(await firstInterest.getAttribute('aria-pressed') === 'true', 'interest control exposes selected state');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('dades:interests:v1') ?? '[]').length) === 1, 'interest choice persists');
  await page.goto(`${baseUrl}/issues/1/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  assert(await page.locator('.entry.is-interest').count() > 0, 'saved interest highlights matching entries', interestTag);
  await page.evaluate(() => localStorage.removeItem('dades:interests:v1'));

  await page.goto(`${baseUrl}/wiki/mcp/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const copyLink = page.locator('[data-copy-link]');
  await copyLink.scrollIntoViewIfNeeded();
  await page.waitForTimeout(360);
  await copyLink.click();
  assert(await copyLink.textContent() === 'Copied', 'article share control reports copied state');
  assert((await page.evaluate(() => navigator.clipboard.readText())).endsWith('/DADES/wiki/mcp/'), 'article share control copies the canonical URL');

  await context.close();
}

async function auditEditorialScenes(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await attachDiagnostics(page, 'editorial-scenes');

  await page.goto(`${baseUrl}/status/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await capture(page, 'status-desktop--hero');
  const firstBoard = page.locator('.status-board-scene').first();
  await firstBoard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(620);
  assert(await firstBoard.locator('[data-reveal].is-revealed').count() >= 2, 'status board scene reveals its copy and table');
  assert(await firstBoard.locator('[role="row"]').count() > 1, 'status board keeps real table rows');
  await capture(page, 'status-desktop--board');

  await page.goto(`${baseUrl}/wiki/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  assert(await page.locator('[data-story-card]').count() >= 3, 'wiki listing keeps Recent-style feature and secondary stories');
  const featuredCard = page.locator('[data-story-card] a').first();
  const beforeTransform = await featuredCard.locator('img').evaluate((image) => getComputedStyle(image).transform);
  await featuredCard.hover();
  await page.waitForTimeout(320);
  const afterTransform = await featuredCard.locator('img').evaluate((image) => getComputedStyle(image).transform);
  assert(beforeTransform !== afterTransform, 'wiki story art scales on hover', { beforeTransform, afterTransform });
  await capture(page, 'wiki-desktop--listing-hover');

  await page.goto(`${baseUrl}/issues/1/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await capture(page, 'issue-desktop--hero');
  const reading = page.locator('.issue-reading');
  await reading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(620);
  assert(await reading.locator('.entry').count() === 5, 'issue reading surface preserves all five entries');
  assert(await reading.locator('[data-reveal].is-revealed').count() > 0, 'issue reading content reveals on scroll');
  await capture(page, 'issue-desktop--reading');

  await page.goto(`${baseUrl}/wiki/mcp/`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await capture(page, 'wiki-article-desktop--hero');
  const articleBody = page.locator('.wiki-article-body');
  await articleBody.scrollIntoViewIfNeeded();
  await page.waitForTimeout(620);
  assert(await articleBody.locator('[data-reveal].is-revealed').count() > 0, 'wiki article prose reveals on scroll');
  await capture(page, 'wiki-article-desktop--body');

  await context.close();
}

(async () => {
  await fs.mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await auditViewport(browser, 'desktop', { width: 1440, height: 1000 });
    await auditViewport(browser, 'mobile', { width: 390, height: 844 });
    await auditProgressiveEnhancement(browser);
    await auditResponsiveHome(browser);
    await auditInteractions(browser);
    await auditEditorialScenes(browser);
    assert(report.consoleErrors.length === 0, 'browser console has no errors', report.consoleErrors);
    assert(report.pageErrors.length === 0, 'browser runtime has no uncaught errors', report.pageErrors);
  } finally {
    await fs.writeFile(path.join(evidenceDir, 'browser-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }

  console.log(JSON.stringify({
    routeCount: report.routeCount,
    captureCount: report.captures.length,
    assertionCount: report.assertions.length,
    failures: report.assertions.filter((entry) => !entry.passed),
    consoleErrors: report.consoleErrors,
    pageErrors: report.pageErrors,
    evidence: path.join(evidenceDir, 'browser-qa.json'),
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
