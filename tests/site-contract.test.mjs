import assert from 'node:assert/strict';
import test from 'node:test';

const origin = process.env.DADES_TEST_ORIGIN ?? 'http://127.0.0.1:4321';

async function readPage(pathname) {
  const response = await fetch(`${origin}${pathname}`);
  assert.equal(response.status, 200);
  return response.text();
}

test('homepage exposes the new editorial hero and mobile navigation while preserving the latest issue', async () => {
  // Given: the production-like static preview is serving the DADES homepage.
  const html = await readPage('/DADES/');

  // When: a reader opens the redesigned landing page.
  const hasEditorialHero = html.includes('data-home-hero');
  const hasMobileMenu = html.includes('data-menu-toggle');

  // Then: the new hero and keyboard-addressable mobile menu exist, and Issue 1 remains reachable.
  assert.equal(hasEditorialHero, true);
  assert.equal(hasMobileMenu, true);
  assert.match(html, /href="\/DADES\/issues\/1\/"/);
  assert.match(html, /WebMCP 챌린지와 블랙박스 LLM의 크기/);
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
  assert.equal(manifest.theme_color, '#f2f1ec');
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    ['/DADES/brand/dades-icon-192.png', '/DADES/brand/dades-icon-512.png'],
  );
});

test('shared navigation exposes layered glass and interaction hooks', async () => {
  // Given: every route is wrapped by the same magazine chrome.
  const html = await readPage('/DADES/');

  // When: the browser hydrates hover, scroll, and menu state.
  // Then: the shell exposes real DOM layers rather than a flattened visual treatment.
  assert.match(html, /data-glass-surface/);
  assert.match(html, /data-glass-highlight/);
  assert.match(html, /data-interaction-root/);
});

test('status and wiki routes use the Recent-inspired immersive and article patterns', async () => {
  // Given: the main non-home editorial routes are served by the production build.
  const [status, wiki, article] = await Promise.all([
    readPage('/DADES/status/'),
    readPage('/DADES/wiki/'),
    readPage('/DADES/wiki/mcp/'),
  ]);

  // When: the route templates render their specialized layouts.
  // Then: status follows the About scene system, while wiki follows Articles and article-detail.
  assert.match(status, /data-immersive-hero/);
  assert.match(status, /data-status-scene/);
  assert.match(wiki, /data-articles-index/);
  assert.ok((wiki.match(/data-story-card/g) ?? []).length >= 3);
  assert.match(article, /data-article-hero/);
  assert.match(article, /data-copy-link/);
});

test('all editorial art is served from customized Book of Shapes SVG exports', async () => {
  // Given: the redesign no longer ships its previous generated raster illustrations.
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

  // Then: every customized export is a real SVG, the old raster route is gone,
  // and the homepage points at the new pattern system.
  assert.equal(home.includes('/DADES/media/'), false);
  assert.match(home, /\/DADES\/patterns\/dades-flow-lines\.svg/);
  assert.equal(oldRaster.status, 404);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/);
    assert.match(await response.text(), /Generated and customized with Book of Shapes/);
  }
});
