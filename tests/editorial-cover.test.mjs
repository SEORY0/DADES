import assert from 'node:assert/strict';
import test from 'node:test';
import { findSourceCover } from '../scripts/editorial/cover.mjs';

test('Given article metadata When source cover is found Then the first HTTPS image is credited to the item', async () => {
  // Given: an issue whose first item page exposes Open Graph image metadata.
  const calls = [];
  const issue = {
    items: [{
      url: 'https://news.example/articles/ai-agents',
      origin: 'Example News',
      tags: ['agents', 'ai-security'],
    }],
  };
  const html = `<html><head>
    <meta content="/images/cover.jpg" property="og:image">
  </head></html>`;

  // When: cover extraction fetches article metadata through the injected transport.
  const result = await findSourceCover({
    issue,
    transport: async (url) => {
      calls.push(url);
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  // Then: the source image is resolved and no fallback image is invented.
  assert.equal(calls.length, 1);
  assert.deepEqual(result.cover, {
    image: 'https://news.example/images/cover.jpg',
    alt: '',
    topic: 'agents',
    sourceUrl: 'https://news.example/articles/ai-agents',
    credit: 'Example News',
  });
  assert.equal(result.diagnostics[0].status, 'ok');
});

test('Given hostile and private URLs When source cover runs Then they are rejected before fetch', async () => {
  // Given: URLs that should never be fetched by metadata extraction.
  const issue = {
    items: [
      { url: 'https://user:pass@example.com/article', origin: 'Credentials', tags: ['ai'] },
      { url: 'https://127.0.0.1/article', origin: 'Loopback', tags: ['ai'] },
      { url: 'http://news.example/article', origin: 'Plain HTTP', tags: ['ai'] },
    ],
  };

  // When: every candidate is rejected at the URL boundary.
  const result = await findSourceCover({
    issue,
    transport: async () => {
      throw new Error('transport should not be called');
    },
  });

  // Then: no cover is returned and each failure is reported as nonfatal diagnostics.
  assert.equal(result.cover, null);
  assert.deepEqual(result.diagnostics.map((entry) => entry.status), ['skipped', 'skipped', 'skipped']);
});

test('Given broken metadata fetches When source cover runs Then failures remain nonfatal', async () => {
  // Given: the article request fails.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['security'] }],
  };

  // When: extraction receives the fetch error.
  const result = await findSourceCover({
    issue,
    transport: async () => {
      throw new Error('network down');
    },
  });

  // Then: callers can continue without a cover.
  assert.equal(result.cover, null);
  assert.match(result.diagnostics[0].error, /network down/);
});

test('Given article redirects When target is same host Then cover extraction follows the redirect', async () => {
  // Given: an article URL that redirects to the equivalent www host and a new path.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };
  const calls = [];

  // When: the metadata response is reached through a bounded safe redirect.
  const result = await findSourceCover({
    issue,
    transport: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Response('', { status: 302, headers: { location: 'https://www.news.example/new/path' } });
      }
      return new Response('<meta name="twitter:image" content="cover.jpg">', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    },
  });

  // Then: the source URL stays grounded in the original linked item.
  assert.equal(calls.length, 2);
  assert.equal(result.cover.image, 'https://www.news.example/new/cover.jpg');
  assert.equal(result.cover.sourceUrl, 'https://news.example/article');
});

test('Given article redirects When target changes host Then cover extraction rejects it', async () => {
  // Given: an article URL that redirects away from the linked source host.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };

  // When: the redirect points at an unrelated host.
  const result = await findSourceCover({
    issue,
    transport: async () => new Response('', { status: 302, headers: { location: 'https://other.example/article' } }),
  });

  // Then: redirect handling fails closed without blocking publication.
  assert.equal(result.cover, null);
  assert.match(result.diagnostics[0].error, /outside source host/);
});

test('Given redirect response has a body When redirect is handled Then the body is cancelled', async () => {
  // Given: a redirect response with an unread body.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };
  let cancelled = false;

  // When: extraction follows the redirect.
  const result = await findSourceCover({
    issue,
    transport: async (url) => {
      if (url === 'https://news.example/article') {
        const body = new ReadableStream({
          cancel() {
            cancelled = true;
          },
        });
        return new Response(body, { status: 302, headers: { location: 'https://www.news.example/article' } });
      }
      return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  // Then: the redirected-away body is not left open.
  assert.equal(result.cover, null);
  assert.equal(cancelled, true);
});

test('Given metadata points at a private image URL When source cover runs Then the image is rejected', async () => {
  // Given: a public article that advertises a local image URL.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };

  // When: image metadata is parsed.
  const result = await findSourceCover({
    issue,
    transport: async () => new Response('<meta property="og:image" content="https://127.0.0.1/cover.jpg">', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }),
  });

  // Then: browser-visible cover metadata remains absent.
  assert.equal(result.cover, null);
  assert.equal(result.diagnostics[0].status, 'miss');
});

test('Given oversized article HTML When source cover runs Then the body limit is nonfatal', async () => {
  // Given: an article response that exceeds the metadata body limit.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };
  let cancelled = false;

  // When: extraction reads the bounded article response.
  const result = await findSourceCover({
    issue,
    transport: async () => {
      const body = new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(512 * 1024 + 1));
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  // Then: the issue can proceed without cover metadata.
  assert.equal(result.cover, null);
  assert.equal(cancelled, true);
  assert.match(result.diagnostics[0].error, /size limit/);
});

test('Given article body stalls When source cover runs Then timeout aborts the body read', { timeout: 2000 }, async () => {
  // Given: response headers arrive but the body never completes on its own.
  const issue = {
    items: [{ url: 'https://news.example/article', origin: 'Example News', tags: ['ai'] }],
  };

  // When: extraction reads the body with a small injected timeout.
  const result = await findSourceCover({
    issue,
    timeoutMs: 20,
    transport: async (url, options) => {
      const body = new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(new Error('body aborted')), { once: true });
          controller.enqueue(new TextEncoder().encode('<html><head>'));
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  // Then: the timeout remains active after headers and turns the stalled read into a nonfatal failure.
  assert.equal(result.cover, null);
  assert.match(result.diagnostics[0].error, /body aborted/);
});

test('Given many issue items When source cover runs Then at most three articles are fetched', async () => {
  // Given: five public item URLs that do not expose image metadata.
  const issue = {
    items: Array.from({ length: 5 }, (_, index) => ({
      url: `https://news${index}.example/article`,
      origin: `News ${index}`,
      tags: ['ai'],
    })),
  };
  const calls = [];

  // When: extraction scans the bounded leading item set.
  const result = await findSourceCover({
    issue,
    transport: async (url) => {
      calls.push(url);
      return new Response('<html><head><title>No image</title></head></html>', { status: 200 });
    },
  });

  // Then: the metadata pass stops at the configured cap.
  assert.equal(result.cover, null);
  assert.equal(calls.length, 3);
});
