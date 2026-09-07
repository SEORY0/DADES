const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.DADES_PLAYWRIGHT_PATH || 'playwright');

const origin = process.env.DADES_TEST_ORIGIN || 'http://localhost:4173';
const output = process.env.DADES_QA_OUTPUT || '/tmp/dades-status-qa';
const statusURL = `${origin}/DADES/status/`;
const report = { checks: [], failures: [], captures: [], errors: [], layouts: [], navigation: [], styles: [], typography: [], leaderArt: [], fixtures: [] };
const metricKeys = ['intelligence', 'outputPrice', 'speed', 'tokens7d'];
let expectedNetworkFailure = false;

function check(condition, label) {
  assert.ok(condition, label);
  report.checks.push(label);
}
async function scenario(name, action) {
  try { await action(); } catch (error) { report.failures.push({ scenario: name, message: error.message }); }
}
async function capture(page, name, fullPage = true) {
  const filename = path.join(output, `${name}.png`);
  await page.mouse.move(0, 0);
  if (fullPage) {
    const dimensions = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, step: innerHeight * 0.75 }));
    for (let y = 0; y < dimensions.height; y += dimensions.step) await page.evaluate((position) => scrollTo(0, position), y);
    await page.evaluate(() => scrollTo(0, 0));
  }
  await page.screenshot({ path: filename, fullPage, animations: 'disabled' });
  const bytes = await fs.readFile(filename);
  check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${name}: valid PNG`);
  report.captures.push({ file: filename, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
async function ready(page, url = statusURL) {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  check(response?.ok(), `${new URL(url).pathname}: responds successfully`);
  await page.evaluate(() => document.fonts.ready);
}
async function layout(page, label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
    table: [...document.querySelectorAll('.board-table-scroll')].map((node) => ({ client: node.clientWidth, scroll: node.scrollWidth })) }));
  report.layouts.push({ label, ...dimensions });
  check(dimensions.scroll <= dimensions.viewport, `${label}: page fits viewport; table scroll stays contained`);
}
async function rowIDs(page) {
  return page.locator('[data-model-row]').evaluateAll((rows) => rows.map((row) => row.dataset.modelRow));
}
function ordered(models, metric) {
  return models.filter((model) => model[metric] !== null).sort((a, b) =>
    (metric === 'outputPrice' ? a[metric] - b[metric] : b[metric] - a[metric]) || a.name.localeCompare(b.name));
}
function money(value) {
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: value > 0 && value < 0.1 ? 4 : 2 }).format(value)}`;
}
function leaderIcon(model) {
  if (!model) return null;
  const providers = { anthropic: 'Anthropic.svg', cohere: 'Cohere.png', tencent: 'Tencent.png', openai: 'OpenAI.svg', deepseek: 'DeepSeek.png', 'z-ai': 'ZAI.svg' };
  const file = model.id.startsWith('google/gemini-') ? 'GoogleGemini.svg' : providers[model.id.split('/')[0]];
  return file ? `/DADES/model-icons/${file}` : null;
}
async function leaderImages(page, board, label) {
  for (const metric of metricKeys) {
    const leader = ordered(board.models, metric)[0]; const expected = leaderIcon(leader);
    const card = page.locator(`[data-metric-shortcut="${metric}"]`); const art = page.locator(`[data-leader-art="${metric}"]`);
    check((await card.getAttribute('data-leader-model') || '') === (leader?.id || ''), `${label} ${metric}: image identity is the actual ranked leader`);
    check(await art.getAttribute('src') === expected, `${label} ${metric}: correct icon source or no source`);
    if (!expected) {
      check(!await art.isVisible(), `${label} ${metric}: unknown or missing icon stays hidden`);
      continue;
    }
    await art.evaluate((image) => image.decode());
    const layers = await art.evaluate((image) => {
      const card = image.closest('[data-metric-shortcut]'); const glass = card.querySelector('.highlight-glass');
      const imageStyle = getComputedStyle(image); const glassStyle = getComputedStyle(glass);
      const imageRect = image.getBoundingClientRect(); const glassRect = glass.getBoundingClientRect();
      const imageZ = imageStyle.zIndex === 'auto' ? 0 : Number(imageStyle.zIndex); const glassZ = glassStyle.zIndex === 'auto' ? 0 : Number(glassStyle.zIndex);
      return { naturalWidth: image.naturalWidth, complete: image.complete, opacity: Number(imageStyle.opacity),
        separate: !glass.contains(image), behind: imageZ < glassZ || (imageZ === glassZ && Boolean(image.compareDocumentPosition(glass) & Node.DOCUMENT_POSITION_FOLLOWING)),
        overlap: imageRect.left < glassRect.right && imageRect.right > glassRect.left && imageRect.top < glassRect.bottom && imageRect.bottom > glassRect.top,
        backdrop: glassStyle.backdropFilter, background: imageStyle.backgroundColor, src: image.getAttribute('src') };
    });
    report.leaderArt.push({ label, metric, model: leader.id, ...layers });
    check(await art.isVisible() && layers.complete && layers.naturalWidth > 0 && layers.opacity > 0, `${label} ${metric}: icon is visibly rendered and decoded`);
    check(layers.separate && layers.behind && layers.overlap && layers.backdrop === 'blur(9px)', `${label} ${metric}: image sits behind its separate glass layer`);
    if (expected.endsWith('/OpenAI.svg') && await page.locator('html').getAttribute('data-theme') === 'ink') {
      const backing = layers.background.match(/\d+/g).map(Number);
      check(backing.length === 3 && backing.every((channel) => channel >= 220) && Math.max(...backing) - Math.min(...backing) <= 12, `${label} ${metric}: black OpenAI icon has an opaque neutral light backing in Ink`);
    }
  }
}
async function refresh(page) {
  const response = page.waitForResponse((response) => response.url().includes('/data/model-board.json'));
  await page.locator('[data-refresh]').click();
  await response;
  await page.waitForFunction(() => !document.querySelector('[data-refresh]').disabled);
  check(await page.locator('[data-refresh]').evaluate((node) => node === document.activeElement), 'manual refresh restores its control focus after completion');
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !(expectedNetworkFailure && message.text().includes('Failed to load resource'))) report.errors.push(message.text());
  });
  try {
    await ready(page);
    const snapshot = JSON.parse(await page.locator('#model-board-data').textContent());
    report.snapshot = { fetchedAt: snapshot.fetchedAt, models: snapshot.models.length,
      metrics: Object.fromEntries(metricKeys.map((key) => [key, ordered(snapshot.models, key).length])) };
    for (const { theme, width } of ['white', 'ink'].flatMap((theme) => [375, 768, 1280].map((width) => ({ theme, width })))) await scenario(`${theme} ${width} responsive and home regression`, async () => {
      const surface = theme === 'white' ? `${width}` : `ink-${width}`;
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await ready(page);
      assert.deepEqual(await page.locator('[data-set-theme]').evaluateAll((buttons) => buttons.map((button) => button.dataset.setTheme)), ['white', 'ink']);
      await page.locator(`[data-set-theme="${theme}"]`).click();
      check(await page.locator('html').getAttribute('data-theme') === theme, `${surface}: selected theme applies`);
      await leaderImages(page, snapshot, `status-${surface}`);
      await layout(page, `status-${surface}`);
      check(await page.locator('[data-model-row]').count() === Math.min(20, report.snapshot.metrics.intelligence), `${width}: initial ranked rows`);
      check(await page.locator('.site-head [aria-current="page"]').first().getAttribute('href') === '/DADES/status/', `${width}: status navigation active`);
      await capture(page, `status-${surface}`);
      await page.mouse.move(0, 0);
      const materials = await page.locator(`${width < 810 ? '.mobile-menu' : '.nav-shell'},.glass-panel:not([data-metric-shortcut]),.highlight-glass`).evaluateAll((nodes) => nodes.map((node) => {
        const css = getComputedStyle(node);
        return { className: node.className, material: Object.fromEntries(['backgroundColor', 'borderRadius', 'backdropFilter', 'borderWidth', 'borderStyle', 'boxShadow'].map((key) => [key, css[key]])) };
      }));
      report.styles.push({ theme, width, materials });
      for (const panel of materials.slice(1)) assert.deepEqual(panel.material, materials[0].material, `${surface}: ${panel.className} matches navigation glass`);
      check(true, `${surface}: every panel exactly matches navigation fill, radius, blur, border and shadow`);
      report.typography.push({ theme, width, values: await page.locator('.board-heading h1,.panel-heading h2,.board-table,.highlight-value strong,.board-caption').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim().slice(0, 45), fontSize: getComputedStyle(node).fontSize, lineHeight: getComputedStyle(node).lineHeight }))) });
      for (const [name, selector] of [['usage', '.usage-panel'], ['table', '#leaderboard'], ['compare', '#model-comparison']]) {
        await page.locator(selector).evaluate((node) => node.scrollIntoView({ block: 'start' }));
        await capture(page, `status-${surface}-${name}-viewport`, false);
      }
      const statusNav = await page.locator('.site-head a').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute('href'), text: link.textContent.trim() })));
      await ready(page, `${origin}/DADES/`);
      check(await page.locator('html').getAttribute('data-theme') === theme, `${surface}: homepage retains selected theme`);
      await page.locator('img').evaluateAll(async (images) => { for (const image of images) { image.scrollIntoView(); try { await image.decode(); } catch {} } });
      for (const item of await page.locator('[data-reveal]').all()) await item.scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollTo(0, 0));
      await layout(page, `home-${surface}`);
      const homeNav = await page.locator('.site-head a').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute('href'), text: link.textContent.trim() })));
      assert.deepEqual(statusNav, homeNav, 'shared navigation links and labels match');
      report.navigation.push({ theme, width, sha256: createHash('sha256').update(JSON.stringify(homeNav)).digest('hex'), links: homeNav });
      check(await page.locator('[data-issue-card]:visible').count() > 0, `${width}: homepage gallery remains visible`);
      await capture(page, `home-${surface}`);
      if (width < 810) {
        await page.locator('[data-menu-toggle]').focus(); await page.keyboard.press('Enter');
        check(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'true', `${width}: keyboard opens menu`);
        await capture(page, `home-menu-${surface}`);
        await page.keyboard.press('Escape');
        check(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded') === 'false', `${width}: Escape closes menu`);
        check(await page.locator('[data-menu-toggle]').evaluate((node) => node === document.activeElement), `${width}: menu restores focus`);
      }
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await scenario('Ink global theme on issue and subscription pages', async () => {
      const issue = await page.locator('.nav-cta').getAttribute('href');
      for (const width of [375, 1280]) for (const [name, route] of [['issue', issue], ['subscribe', '/DADES/subscribe/']]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 }); await ready(page, `${origin}${route}`);
        check(await page.locator('html').getAttribute('data-theme') === 'ink', `${name}-${width}: Ink persists outside the status page`);
        await page.locator('img').evaluateAll(async (images) => { for (const image of images) { image.scrollIntoView(); await image.decode(); } });
        check(await page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), `${name}-${width}: all images load`);
        await layout(page, `${name}-ink-${width}`); await capture(page, `${name}-ink-${width}`);
      }
    });
    await scenario('White Ink persistence and legacy Paper migration under dark OS', async () => {
      const migration = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: 'dark', reducedMotion: 'reduce',
        storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'dades:theme', value: 'paper' }] }] } });
      const themed = await migration.newPage();
      themed.on('pageerror', (error) => report.errors.push(error.message));
      themed.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
      try {
        await ready(themed);
        check(await themed.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), 'migration fixture uses a dark OS preference');
        check(await themed.locator('html').getAttribute('data-theme') === 'white', 'legacy Paper explicitly migrates to White despite dark OS');
        check(await themed.evaluate(() => localStorage.getItem('dades:theme')) === 'white', 'legacy Paper storage is replaced with White');
        assert.deepEqual(await themed.locator('[data-set-theme]').evaluateAll((buttons) => buttons.map((button) => button.dataset.setTheme)), ['white', 'ink']);
        for (const theme of ['ink', 'white']) {
          await themed.locator(`[data-set-theme="${theme}"]`).click(); await themed.reload({ waitUntil: 'networkidle' });
          check(await themed.locator('html').getAttribute('data-theme') === theme && await themed.evaluate(() => localStorage.getItem('dades:theme')) === theme, `${theme}: footer choice persists after reload`);
          check(await themed.locator(`[data-set-theme="${theme}"]`).getAttribute('aria-pressed') === 'true', `${theme}: persisted footer choice is announced`);
          await themed.locator('.theme-row').scrollIntoViewIfNeeded(); await capture(themed, `theme-footer-${theme}`, false);
        }
      } finally { await migration.close(); }
    });
    await scenario('all four metrics sort numerically', async () => {
      await ready(page);
      for (const { width, metric } of [375, 1280].flatMap((width) => metricKeys.map((metric) => ({ width, metric })))) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.locator(`[data-metric="${metric}"]`).click();
        const expected = ordered(snapshot.models, metric);
        assert.deepEqual(await rowIDs(page), expected.slice(0, 20).map((model) => model.id));
        check(await page.locator(`[data-column="${metric}"]`).getAttribute('aria-sort') === (metric === 'outputPrice' ? 'ascending' : 'descending'), `${metric}: numeric order and accessible sort`);
        check(await page.locator('[data-ranking-empty]').isVisible() === (expected.length === 0), `${metric}: missing observations are excluded`);
        if (!expected.length) check((await page.locator('[data-ranking-empty] h3').textContent()).includes('관측값'), `${metric}: empty state says observation unavailable`);
        check(await page.locator('.board-table thead th:visible').count() === (width === 375 ? 3 : 8), `${width} ${metric}: relevant table columns remain visible`);
        await capture(page, `metric-${metric}-${width}`);
      }
      const headers = await page.locator('.board-table thead').textContent();
      check(headers.includes('$/1M') && headers.includes('tok/s') && headers.includes('주간 tokens') && headers.includes('AA 지수'), 'table communicates four distinct metric units');
    });
    await scenario('search provider URL reload and reset', async () => {
      await ready(page);
      const model = ordered(snapshot.models, 'intelligence')[0];
      const query = model.name.replace(/^[^:]+:\s*/, '');
      await page.locator('[data-model-provider]').selectOption(model.provider);
      await page.locator('[data-model-query]').fill(query);
      await page.locator('[data-metric="outputPrice"]').click();
      const expected = ordered(snapshot.models.filter((item) => item.provider === model.provider && query.toLowerCase().split(/\s+/).every((term) => `${item.name} ${item.provider}`.toLowerCase().includes(term))), 'outputPrice');
      assert.deepEqual(await rowIDs(page), expected.slice(0, 20).map((item) => item.id));
      const before = page.url(); await page.reload({ waitUntil: 'networkidle' });
      check(page.url() === before && await page.locator('[data-model-query]').inputValue() === query, 'reload restores search and URL');
      check(await page.locator('[data-model-provider]').inputValue() === model.provider, 'reload restores provider');
      check(await page.locator('[data-metric="outputPrice"]').getAttribute('aria-pressed') === 'true', 'reload restores metric');
      await capture(page, 'filtered-reloaded');
      await page.locator('[data-model-query]').fill('__no_such_model_qa__');
      check(await page.locator('[data-ranking-empty]').isVisible(), 'no-match search displays reset');
      await page.locator('[data-reset]').click();
      check(!new URL(page.url()).search && await page.locator('[data-model-provider]').inputValue() === 'all', 'reset clears all filter URL state');
      check(await page.locator('[data-model-query]').evaluate((node) => node === document.activeElement), 'reset returns keyboard focus to search');
      await page.locator('[data-more]').click();
      check(await page.locator('[data-model-row]').count() === Math.min(40, report.snapshot.metrics.intelligence), 'more reveals next twenty ranked models');
    });
    await scenario('three-model comparison cap cost and removal', async () => {
      await ready(page);
      const candidates = ordered(snapshot.models, 'intelligence').slice(0, 4);
      for (const model of candidates.slice(0, 3)) await page.locator(`[data-compare=${JSON.stringify(model.id)}]`).check();
      await page.locator(`[data-compare=${JSON.stringify(candidates[3].id)}]`).click();
      check(await page.locator('[data-comparison] article').count() === 3 && await page.locator('[data-selection-count]').textContent() === '3 / 3', 'comparison caps at three');
      check(!await page.locator(`[data-compare=${JSON.stringify(candidates[3].id)}]`).isChecked(), 'fourth checkbox remains unchecked');
      await page.locator('[data-budget="input"]').fill('2'); await page.locator('[data-budget="output"]').fill('0.5');
      for (const model of candidates.slice(0, 3)) {
        const card = page.locator('[data-comparison] article').filter({ has: page.locator(`[data-remove=${JSON.stringify(model.id)}]`) });
        const expected = model.inputPrice === null || model.outputPrice === null ? '미제공' : money(model.inputPrice * 2 + model.outputPrice * 0.5);
        check(await card.locator('.estimated-cost').textContent() === expected, `${model.id}: cost equals 2M input plus 0.5M output`);
      }
      await capture(page, 'comparison-three-costs');
      await page.locator('#model-comparison').evaluate((node) => node.scrollIntoView({ block: 'start' }));
      await capture(page, 'comparison-three-1280-viewport', false);
      for (const width of [375, 768]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await layout(page, `comparison-${width}`); await capture(page, `comparison-three-${width}`);
        await page.locator('#model-comparison').evaluate((node) => node.scrollIntoView({ block: 'start' }));
        await capture(page, `comparison-three-${width}-viewport`, false);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('[data-remove]').first().click();
      check(await page.locator('[data-comparison] article').count() === 2, 'remove button removes one comparison');
      await page.locator('[data-compare]:checked').first().uncheck();
      check(await page.locator('[data-comparison] article').count() === 1, 'unchecking row removes its comparison');
    });
    await scenario('refresh same feed network failure invalid schema', async () => {
      await ready(page);
      const before = await rowIDs(page); const timestamp = await page.locator('[data-board-time]').getAttribute('datetime');
      await refresh(page);
      check((await page.locator('[data-board-feedback]').textContent()).includes('최신 파일'), 'same-feed refresh acknowledges existing latest snapshot');
      expectedNetworkFailure = true;
      await page.route('**/data/model-board.json*', (route) => route.abort('failed'));
      await page.locator('[data-refresh]').click();
      await page.waitForFunction(() => !document.querySelector('[data-refresh]').disabled);
      check((await page.locator('[data-board-feedback]').textContent()).includes('마지막 관측값'), 'network failure is explained');
      check(await page.locator('[data-refresh]').evaluate((node) => node === document.activeElement), 'failed manual refresh restores its control focus');
      assert.deepEqual(await rowIDs(page), before);
      await capture(page, 'network-failure-last-good');
      await page.unroute('**/data/model-board.json*'); expectedNetworkFailure = false;
      await page.route('**/data/model-board.json*', (route) => route.fulfill({ json: { ...snapshot, schemaVersion: -1 } }));
      await refresh(page);
      assert.deepEqual(await rowIDs(page), before);
      check(await page.locator('[data-board-time]').getAttribute('datetime') === timestamp, 'invalid payload preserves last good timestamp and rows');
      await page.unroute('**/data/model-board.json*');
    });
    await scenario('aged initial data refreshes timestamp freshness and charts', async () => {
      await page.clock.install({ time: new Date() });
      const agedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const aged = { ...snapshot, fetchedAt: agedAt, sources: snapshot.sources.map((source) => source.id === 'openrouter-catalog' ? { ...source, observedAt: agedAt } : source) };
      await page.route(/\/DADES\/status\/$/, async (route) => {
        const response = await route.fetch(); const html = await response.text();
        await route.fulfill({ response, body: html.replace(/(<script[^>]*id="model-board-data"[^>]*>)[\s\S]*?(<\/script>)/, (_match, open, close) => open + JSON.stringify(aged).replaceAll('<', '\\u003c') + close) });
      });
      await ready(page);
      check(await page.locator('[data-freshness]').getAttribute('data-stale') === 'true', 'three-hour-old snapshot shows stale status');
      await capture(page, 'stale-snapshot');
      const freshAt = new Date().toISOString();
      const fresh = { ...snapshot, fetchedAt: freshAt, sources: snapshot.sources.map((source) => source.id === 'openrouter-catalog' ? { ...source, observedAt: freshAt } : source) };
      await page.route('**/data/model-board.json*', (route) => route.fulfill({ json: fresh }));
      const focusedDot = page.locator('.chart-dot').last(); await focusedDot.focus(); const oldAsOf = await page.locator('[data-board-time]').getAttribute('datetime');
      await Promise.all([page.waitForResponse((response) => response.url().includes('/data/model-board.json')), page.clock.fastForward(60000)]);
      await page.waitForFunction(() => document.querySelector('[data-board-feedback]').textContent.includes('새 관측값이 있습니다'));
      check(await focusedDot.evaluate((node) => node === document.activeElement) && await page.locator('[data-board-time]').getAttribute('datetime') === oldAsOf, 'automatic newer feed preserves chart focus and old timestamp');
      await capture(page, 'automatic-refresh-deferred');
      await refresh(page);
      check(await page.locator('[data-board-time]').getAttribute('datetime') === fresh.fetchedAt, 'newer feed updates header timestamp');
      check(await page.locator('[data-freshness]').getAttribute('data-stale') === 'false', 'newer feed clears stale indicator');
      check((await page.locator('[data-board-feedback]').textContent()).includes('업데이트'), 'refresh announces new observations');
      await capture(page, 'refreshed-snapshot');
      await page.unroute('**/data/model-board.json*'); await page.unroute(/\/DADES\/status\/$/);
    });
    await scenario('keyboard metric shortcut and no JavaScript fallback', async () => {
      await ready(page); await page.locator('[data-metric="tokens7d"]').focus(); await page.keyboard.press('Enter');
      check(await page.locator('[data-metric="tokens7d"]').getAttribute('aria-pressed') === 'true', 'keyboard activates metric');
      await page.locator('[data-metric-shortcut="outputPrice"]').click();
      check(new URL(page.url()).hash === '#leaderboard', 'highlight shortcut navigates to leaderboard hash');
      check(await page.locator('[data-metric="outputPrice"]').getAttribute('aria-pressed') === 'true', 'highlight shortcut changes metric');
      const dot = page.locator('.chart-dot').last(); await dot.focus();
      check(await page.locator('[data-chart-readout]').textContent() === await dot.getAttribute('aria-label'), 'keyboard chart focus exposes that model values');
      check(!await page.locator('#board-method').evaluate((node) => node.open), 'sources start collapsed');
      await page.locator('#board-method summary').click();
      check(await page.locator('[data-board-sources] li:visible').count() === snapshot.sources.length, 'source disclosure opens every supplied source');
      await capture(page, 'sources-expanded');
      const plainContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
      const plain = await plainContext.newPage(); await ready(plain);
      check(await plain.locator('[data-model-row]').count() === Math.min(20, report.snapshot.metrics.intelligence), 'no-JS server-rendered rankings remain available');
      check(!await plain.locator('.board-toolbar').isVisible() && !await plain.locator('[data-refresh]').isVisible(), 'no-JS interactive controls stay hidden');
      check(await plain.locator('.board-table thead th:visible').count() === 8, 'no-JS fallback retains all metric and price columns');
      check(await plain.locator('noscript').textContent(), 'no-JS explanation is present');
      await layout(plain, 'status-nojs-375'); await capture(plain, 'status-nojs-375'); await plainContext.close();
    });
    await scenario('refreshed leader icons match known unknown and missing models', async () => {
      await ready(page);
      const iconFiles = ['Anthropic.svg', 'Cohere.png', 'Tencent.png', 'OpenAI.svg', 'GoogleGemini.svg', 'DeepSeek.png', 'ZAI.svg'];
      const cases = iconFiles.map((file) => ({ label: file.split('.')[0], model: snapshot.models.find((model) => model.outputPrice !== null && leaderIcon(model)?.endsWith(`/${file}`)) }));
      cases.push({ label: 'Gemma-unmapped', model: snapshot.models.find((model) => model.id.startsWith('google/gemma') && model.outputPrice !== null) },
        { label: 'unknown-provider', model: snapshot.models.find((model) => !leaderIcon(model) && !model.id.startsWith('google/') && !model.id.startsWith('~') && model.outputPrice !== null) });
      check(cases.every((fixture) => fixture.model), 'snapshot supplies real model identities for every icon refresh fixture');
      cases.push({ label: 'missing-leader', model: null });
      let feed = snapshot;
      await page.route('**/data/model-board.json*', (route) => route.fulfill({ json: feed }));
      try {
        for (const [index, fixture] of cases.entries()) {
          feed = { ...snapshot, fetchedAt: new Date(Math.max(Date.now(), Date.parse(snapshot.fetchedAt)) + 300000 + index * 1000).toISOString(), models: fixture.model ? [fixture.model] : [] };
          report.fixtures.push({ label: fixture.label, model: fixture.model?.id ?? null, scope: 'Intercepted single-model or empty feed; identity and values are from the snapshot' });
          await refresh(page); await leaderImages(page, feed, `refreshed-${fixture.label}`);
          check(await page.locator('[data-usage-empty]').isVisible() === (ordered(feed.models, 'tokens7d').length === 0), `${fixture.label}: usage empty state tracks available observations`);
          const hasPoints = Boolean(fixture.model && [fixture.model.intelligence, fixture.model.inputPrice, fixture.model.outputPrice].every((value) => value !== null));
          check(await page.locator('.chart-dot').count() === Number(hasPoints) && await page.locator('[data-scatter-hint]').isVisible() === hasPoints, `${fixture.label}: scatter points and selection hint match observed values`);
          if (!hasPoints) check(await page.locator('[data-chart-readout]').textContent() === '관측값 대기', `${fixture.label}: empty scatter reports waiting for observations`);
          await page.evaluate(() => scrollTo(0, 0)); await capture(page, `leader-art-${fixture.label}`, false);
          if (!fixture.model) { await page.locator('.usage-panel').scrollIntoViewIfNeeded(); await capture(page, 'usage-empty-after-refresh', false); }
        }
        feed = { ...snapshot, fetchedAt: new Date(Math.max(Date.now(), Date.parse(snapshot.fetchedAt)) + 400000).toISOString() };
        await refresh(page);
        check(!await page.locator('[data-usage-empty]').isVisible() && await page.locator('[data-usage-bars] li').count() === Math.min(5, report.snapshot.metrics.tokens7d), 'restored snapshot hides usage empty state and restores observed bars');
        check(await page.locator('[data-scatter-hint]').isVisible() && await page.locator('.chart-dot').count() > 0, 'restored snapshot returns scatter points and their selection hint');
        await page.locator('.usage-panel').scrollIntoViewIfNeeded(); await capture(page, 'usage-restored-after-refresh', false);
      } finally { await page.unroute('**/data/model-board.json*'); }
    });
    await scenario('Ink print uses a white canvas and dark text', async () => {
      await ready(page); await page.emulateMedia({ media: 'print' });
      try {
        const colors = await page.evaluate(() => ({ canvas: getComputedStyle(document.querySelector('.page.page-immersive')).backgroundColor,
          panel: getComputedStyle(document.querySelector('.leaderboard-panel')).backgroundColor, text: getComputedStyle(document.querySelector('.board-heading h1')).color }));
        report.print = colors;
        check(colors.canvas === 'rgb(255, 255, 255)' && colors.panel === 'rgb(255, 255, 255)', 'Ink print canvas and glass panels become white');
        check(colors.text.match(/\d+/g).slice(0, 3).every((channel) => Number(channel) < 128), 'Ink print heading uses dark readable text');
        await capture(page, 'status-ink-print');
      } finally { await page.emulateMedia({ media: 'screen' }); }
    });
    check(report.errors.length === 0, 'no unexpected browser errors');
  } catch (error) { report.failures.push({ scenario: 'setup or browser errors', message: error.message }); }
  finally { await browser.close(); await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, captures: report.captures.length, errors: report.errors, report: path.join(output, 'report.json') }, null, 2));
  process.exitCode = report.failures.length || report.errors.length ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
