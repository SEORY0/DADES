import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const issueDirectory = new URL('../src/content/issues/', import.meta.url);
const issueFiles = (await readdir(issueDirectory)).filter((name) => name.endsWith('.json'));
const issues = (await Promise.all(issueFiles.map(async (name) => JSON.parse(await readFile(new URL(name, issueDirectory), 'utf8'))))).sort((a, b) => b.number - a.number);

const origin = process.env.DADES_TEST_ORIGIN ?? 'http://127.0.0.1:4321';

async function readPage(pathname) {
  const response = await fetch(`${origin}${pathname}`);
  assert.equal(response.status, 200);
  return response.text();
}

test('homepage lists every published issue as an image and title link', async () => {
  const html = await readPage('/DADES/');
  assert.equal((html.match(/<li[^>]*data-issue-card/g) ?? []).length, issues.length);
  assert.match(html, /data-gallery-query/);
  assert.match(html, /data-gallery-empty/);
  for (const issue of issues) {
    assert.ok(html.includes(`href="/DADES/issues/${issue.number}/"`));
    assert.ok(html.includes(issue.title));
  }
  const cards = [...html.matchAll(/<li[^>]*data-issue-card[\s\S]*?<\/li>/g)];
  for (const [card] of cards) {
    if (!card.includes('has-no-image')) assert.match(card, /<img[^>]+src=/);
    assert.match(card, /<h2/);
    assert.doesNotMatch(card, /<p[ >]/);
  }
});

test('issue pages preserve all five curated entries and their clip controls', async () => {
  // Given: the published first issue remains the content source of truth.
  const html = await readPage('/DADES/issues/1/');

  // When: a reader opens the issue after the shared-shell redesign.
  const entryCount = (html.match(/class="entry"/g) ?? []).length;
  const clipControlCount = (html.match(/data-clip-id=/g) ?? []).length;

  // Then: every curated item and every browser-local clip action is still rendered.
  assert.equal(entryCount, 5);
  assert.equal(clipControlCount, 5);
  assert.match(html, /AI가 설계한 CPU가 둠을 성공적으로 실행/);
  assert.match(html, /블랙박스 LLM의 크기를 재는 법/);
});

test('installable app metadata publishes the redesigned DADES icon family', async () => {
  // Given: the browser requests the production web app manifest.
  const response = await fetch(`${origin}/DADES/manifest.webmanifest`);

  // When: it reads the identity and icon declarations.
  const manifest = await response.json();

  // Then: the new editorial mark is used at both required PWA sizes.
  assert.equal(response.status, 200);
  assert.equal(manifest.theme_color, '#ffffff');
  assert.equal(manifest.background_color, '#ffffff');
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    ['/DADES/brand/dades-icon-192.png', '/DADES/brand/dades-icon-512.png'],
  );
});

test('shared footer offers White and Ink with White as the static default', async () => {
  // Given: a reader loads the shared shell before scripts run.
  const html = await readPage('/DADES/');
  // When: the browser reads the available theme controls.
  const themes = [...html.matchAll(/<button[^>]+data-set-theme="([^"]+)"/g)].map((match) => match[1]);
  // Then: there are only two themes and the initial document uses White.
  assert.deepEqual(themes, ['white', 'ink']);
  assert.match(html, /<html[^>]+data-theme="white"/);
  assert.match(html, /data-set-theme="white"[^>]+aria-pressed="true"/);
});

for (const scenario of [
  { saved: 'paper', dark: false, expected: 'white' },
  { saved: 'paper', dark: true, expected: 'white' },
  { saved: 'white', dark: true, expected: 'white' },
  { saved: 'ink', dark: false, expected: 'ink' },
  { saved: null, dark: false, expected: 'white' },
  { saved: null, dark: true, expected: 'ink' },
  { saved: 'invalid', dark: false, expected: 'white' },
  { saved: 'invalid', dark: true, expected: 'ink' },
  { saved: null, dark: true, expected: 'ink', blocked: 'read' },
  { saved: 'paper', dark: true, expected: 'white', blocked: 'write' },
]) {
  test(`theme bootstrap selects ${scenario.expected} for ${JSON.stringify(scenario)}`, async () => {
    // Given: the real inline bootstrap and browser preference/storage boundaries.
    const html = await readPage('/DADES/');
    const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).find((value) => value.includes("localStorage.getItem('dades:theme')"));
    assert.ok(script);
    const attributes = new Map();
    const storage = new Map(scenario.saved === null ? [] : [['dades:theme', scenario.saved]]);
    const meta = new Map();
    // When: the bootstrap runs before the first paint.
    runInNewContext(script, {
      document: {
        documentElement: { classList: { add() {} }, setAttribute: (key, value) => attributes.set(key, value) },
        querySelector: () => ({ setAttribute: (key, value) => meta.set(key, value) }),
      },
      window: { matchMedia: () => ({ matches: scenario.dark }) },
      localStorage: {
        getItem(key) { if (scenario.blocked === 'read') throw new Error('storage blocked'); return storage.get(key) ?? null; },
        setItem(key, value) { if (scenario.blocked === 'write') throw new Error('storage full'); storage.set(key, value); },
      },
    });
    // Then: theme, browser chrome, and legacy migration agree even when storage fails.
    assert.equal(attributes.get('data-theme'), scenario.expected);
    assert.equal(meta.get('content'), scenario.expected === 'ink' ? '#111315' : '#ffffff');
    if (scenario.saved === 'paper' && !scenario.blocked) assert.equal(storage.get('dades:theme'), 'white');
  });
}

test('shared navigation keeps the Recent capsule lockup and interaction hooks', async () => {
  // Given: every route is wrapped by the same magazine chrome.
  const html = await readPage('/DADES/');

  // When: the browser hydrates hover, scroll, and menu state.
  // Then: both capsules are still glass surfaces driven by the pointer root.
  // The capsule paints its own fill (Recent's measured recipe), so there is no
  // separate highlight span to assert — the lockup and the dock are the contract.
  assert.equal((html.match(/data-glass-surface/g) ?? []).length, 2);
  assert.match(html, /data-interaction-root/);
  assert.match(html, /data-menu-toggle/);

  // And: the brand is the sheep glyph + wordmark lockup, not a raster logo.
  assert.match(html, /class="brand-glyph"/);
  assert.match(html, /class="brand-word"[^>]*>DADES</);
});

test('status exposes sourced model comparisons while wiki remains a searchable finding aid', async () => {
  // Given: the main non-home editorial routes are served by the production build.
  const [status, wiki, article] = await Promise.all([
    readPage('/DADES/status/'),
    readPage('/DADES/wiki/'),
    readPage('/DADES/wiki/mcp/'),
  ]);

  // When: the route templates render their specialized layouts.
  const rowCount = (wiki.match(/data-wiki-row data-category=/g) ?? []).length;
  const searchKeyCount = (wiki.match(/data-terms="/g) ?? []).length;
  const groupKeys = [...wiki.matchAll(/data-wiki-group="([^"]+)"/g)].map((match) => match[1]);
  const scopeKeys = [...wiki.matchAll(/data-wiki-scope="([^"]+)"/g)].map((match) => match[1]);
  const groupCounts = [...wiki.matchAll(/<span data-group-count>(\d+)<\/span>/g)].map((match) =>
    Number(match[1]),
  );
  const statedTotal = Number(wiki.match(/class="wiki-stats">\s*항목 (\d+)/)?.[1]);

  // Then: the status page serves real model data and all requested comparison fields.
  assert.match(status, /data-model-board/);
  assert.match(status, /data-model-row=/);
  assert.match(status, /data-board-sources/);
  for (const metric of ['intelligence', 'outputPrice', 'speed', 'tokens7d']) {
    assert.ok(status.includes('data-column="' + metric + '"'));
  }
  const serialized = status.match(/<script[^>]*id="model-board-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(serialized);
  const snapshot = JSON.parse(serialized);
  assert.ok(snapshot.models.length > 0);
  assert.ok(snapshot.sources.every((source) => source.url.startsWith('https://')));

  // 그리고 위키 첫 지면은 이야기 카드 더미가 아니라 찾아보기 지면이다 —
  // 검색창·갈래 거르개·갈래별 묶음이 있고, 모든 행이 거르개가 훑을 검색 키를 갖는다.
  // 머리글에 적힌 항목 수와 갈래별 개수의 합이 실제 행 수와 어긋나면 색인이 거짓말을 한다.
  // 훅 이름만 보면 아래 인라인 스크립트의 선택자에도 걸리므로, 지면에 실제로 놓인
  // 요소를 집어서 본다.
  assert.match(wiki, /data-articles-index/);
  assert.match(wiki, /<form[^>]*data-wiki-filter/);
  assert.match(wiki, /<input[^>]*data-wiki-query/);
  assert.match(wiki, /<p[^>]*data-wiki-empty/);
  assert.ok(rowCount >= 6, `expected the full glossary to be listed, saw ${rowCount} row(s)`);
  assert.equal(searchKeyCount, rowCount);
  assert.ok(groupKeys.length >= 2, `expected grouped terms, saw ${groupKeys.length} group(s)`);
  assert.deepEqual(scopeKeys, ['all', ...groupKeys]);
  assert.equal(groupCounts.length, groupKeys.length);
  assert.equal(
    groupCounts.reduce((sum, count) => sum + count, 0),
    rowCount,
  );
  assert.equal(statedTotal, rowCount);

  // 그리고 낱개 용어 지면은 기사 상세 패턴을 그대로 쓴다.
  assert.match(article, /data-article-hero/);
  assert.match(article, /data-copy-link/);
});

test('gallery photographs and existing editorial SVG assets are served locally', async () => {
  const home = await readPage('/DADES/');
  const patternFiles = [
    'dades-flow-lines.svg',
    'dades-interference-mesh.svg',
    'dades-isometric-noise.svg',
    'dades-node-garden.svg',
    'dades-rect-void.svg',
    'dades-spiral-mesh.svg',
  ];

  // When: a reader loads the editorial artwork used across the site.
  const responses = await Promise.all(
    patternFiles.map((file) => fetch(`${origin}/DADES/patterns/${file}`)),
  );
  const oldRaster = await fetch(`${origin}/DADES/media/dades-hero.webp`);

  assert.equal(home.includes('/DADES/media/'), false);
  const covers = [...home.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(covers.length >= issues.filter((issue) => issue.cover).length);
  for (const src of covers) {
    assert.ok(src.startsWith('/DADES/'));
    const response = await fetch(`${origin}${src}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /image\//);
  }
  assert.equal(oldRaster.status, 404);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/);
    assert.match(await response.text(), /Generated and customized with Book of Shapes/);
  }
});
