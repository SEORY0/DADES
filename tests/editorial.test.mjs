import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModelJson } from '../scripts/editorial/anthropic.mjs';
import { collectCandidates, makeIssuePlan, normalizeUrl, parseFeed } from '../scripts/editorial/collect.mjs';
import { toIssueJson, validateDraft } from '../scripts/editorial/schema.mjs';

const feed = {
  name: 'Fixture AI Feed',
  url: 'https://example.com/feed.xml',
  source: 'release',
  origin: 'Fixture Lab',
  allowHosts: ['example.com'],
};

test('Given RSS entries When parsed Then normalized in-scope candidates are collected once', async () => {
  // Given: a feed with duplicate tracked URLs, stale content, and one unrelated item.
  const now = new Date('2026-09-04T00:00:00Z');
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>AI agent security update</title><link>https://example.com/a?utm_source=x</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>Prompt injection mitigation for LLM agents.</description></item>
    <item><title>AI agent security update copy</title><link>https://example.com/a</link><pubDate>Thu, 03 Sep 2026 01:00:00 GMT</pubDate><description>LLM duplicate.</description></item>
    <item><title>Garden notes</title><link>https://example.com/b</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>Unrelated.</description></item>
    <item><title>Old AI paper</title><link>https://example.com/c</link><pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate><description>AI.</description></item>
  </channel></rss>`;
  const config = {
    collection: { windowDays: 7, maxCandidates: 10, timeoutMs: 1000, userAgent: 'test', minItems: 3, minOrigins: 2 },
    scopeKeywords: ['ai', 'llm', 'prompt injection'],
    feeds: [feed],
  };
  const transport = async () => new Response(xml, { status: 200 });

  // When: collection runs through the HTTP transport seam.
  const result = await collectCandidates({ config, published: { urls: new Set(), ids: new Set() }, now, transport });

  // Then: only the fresh canonical URL remains.
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].url, 'https://example.com/a');
  assert.equal(result.candidates[0].candidateId, 'c1');
  assert.equal(result.diagnostics[0].status, 'ok');
});

test('Given published state When draft is validated Then invented links are rejected', () => {
  // Given: three grounded candidates from two origins and a draft that changes one URL.
  const plan = makeIssuePlan({ now: new Date('2026-09-04T00:00:00Z'), maxNumber: 1 });
  const candidates = [
    candidate('c1', 'https://example.com/a', 'Fixture Lab'),
    candidate('c2', 'https://example.org/b', 'Other Lab'),
    candidate('c3', 'https://example.org/c', 'Other Lab'),
  ];
  const draft = validDraft(plan, candidates);
  draft.items[1].url = 'https://invented.example/nope';

  // When / Then: deterministic validation blocks the model output.
  assert.throws(
    () => validateDraft({ draft, candidates, published: { urls: new Set(), ids: new Set() }, plan, quality: { minItems: 3, minOrigins: 2 } }),
    /changed source URL/,
  );
});

test('Given valid draft When converted Then candidate IDs are removed before publishing', () => {
  // Given: a model draft grounded in candidate IDs.
  const plan = makeIssuePlan({ now: new Date('2026-09-04T00:00:00Z'), maxNumber: 1 });
  const candidates = [
    candidate('c1', 'https://example.com/a', 'Fixture Lab'),
    candidate('c2', 'https://example.org/b', 'Other Lab'),
    candidate('c3', 'https://example.org/c', 'Other Lab'),
  ];
  const draft = validateDraft({
    draft: validDraft(plan, candidates),
    candidates,
    published: { urls: new Set(), ids: new Set() },
    plan,
    quality: { minItems: 3, minOrigins: 2 },
  });

  // When: the content JSON is prepared.
  const issue = toIssueJson(draft);

  // Then: the Astro issue schema receives only publishable fields.
  assert.equal(issue.number, 2);
  assert.equal(issue.items.length, 3);
  assert.equal('candidateId' in issue.items[0], false);
});

test('Given Anthropic text response When parsed Then only the JSON object is used', () => {
  // Given: a Messages API response with one text block.
  const payload = { content: [{ type: 'text', text: '```json\n{"number":2,"items":[]}\n```' }] };

  // When: the response is parsed.
  const parsed = parseModelJson(payload);

  // Then: fenced prose is ignored around the JSON object.
  assert.deepEqual(parsed, { number: 2, items: [] });
});

test('Given Atom feed When parsed Then href links and updated dates are supported', () => {
  // Given: an Atom entry from an allowlisted host.
  const xml = `<feed><entry><title>LLM safety note</title><link href="https://example.com/atom"/><updated>2026-09-03T00:00:00Z</updated><summary>AI security research.</summary></entry></feed>`;

  // When: parsing runs without a full XML dependency.
  const parsed = parseFeed(xml, feed);

  // Then: the entry is normalized into the candidate shape.
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, 'https://example.com/atom');
});

test('Given tracked URL When normalized Then marketing parameters and fragments are removed', () => {
  assert.equal(normalizeUrl('https://example.com/a?utm_campaign=x&ok=1#top'), 'https://example.com/a?ok=1');
});

test('Given broad source feed When collecting Then email and generic security false positives are excluded', async () => {
  // Given: unrelated text contains "email", generic vulnerability text lacks AI, and one item is AI security.
  const now = new Date('2026-09-04T00:00:00Z');
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Email delivery details</title><link>https://example.com/email</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>Routine email service details.</description></item>
    <item><title>Vulnerability advisory</title><link>https://example.com/vuln</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>Security patch for a router.</description></item>
    <item><title>Threat model guidance for router vulnerability response</title><link>https://example.com/router</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>Security agent patch and safety guidance.</description></item>
    <item><title>LLM prompt injection mitigation</title><link>https://example.com/ai-sec</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>AI security guidance for agents.</description></item>
  </channel></rss>`;
  const config = {
    collection: { windowDays: 7, maxCandidates: 10, timeoutMs: 1000, userAgent: 'test', minItems: 1, minOrigins: 1 },
    scopeKeywords: ['ai', 'security', 'vulnerability', 'prompt injection'],
    feeds: [feed],
  };

  // When: the collector filters source items.
  const result = await collectCandidates({
    config,
    published: { urls: new Set(), ids: new Set() },
    now,
    transport: async () => new Response(xml, { status: 200 }),
  });

  // Then: only the explicitly AI-security item remains.
  assert.deepEqual(result.candidates.map((candidate) => candidate.url), ['https://example.com/ai-sec']);
});

test('Given malformed feed item When parsed Then valid sibling items survive', () => {
  // Given: one item has an invalid date and another is valid.
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Broken AI item</title><link>https://example.com/broken</link><pubDate>not-a-date</pubDate><description>AI security.</description></item>
    <item><title>Valid AI item</title><link>https://example.com/valid</link><pubDate>Thu, 03 Sep 2026 00:00:00 GMT</pubDate><description>AI security.</description></item>
  </channel></rss>`;

  // When: the parser encounters both entries.
  const parsed = parseFeed(xml, feed);

  // Then: the bad entry is isolated instead of discarding the whole feed.
  assert.deepEqual(parsed.map((entry) => entry.url), ['https://example.com/valid']);
});

test('Given one noisy origin When max candidates is small Then collection keeps source diversity', async () => {
  // Given: one origin has the freshest two entries, with another origin still available.
  const now = new Date('2026-09-04T00:00:00Z');
  const feeds = [
    { ...feed, name: 'Fresh Lab', origin: 'Fresh Lab' },
    { ...feed, name: 'Other Lab', url: 'https://other.example/feed.xml', origin: 'Other Lab', allowHosts: ['other.example'] },
  ];
  const xmlByUrl = new Map([
    [feeds[0].url, `<?xml version="1.0"?><rss><channel>
      <item><title>AI agent first</title><link>https://example.com/a</link><pubDate>Thu, 03 Sep 2026 03:00:00 GMT</pubDate><description>LLM security.</description></item>
      <item><title>AI agent second</title><link>https://example.com/b</link><pubDate>Thu, 03 Sep 2026 02:00:00 GMT</pubDate><description>LLM security.</description></item>
    </channel></rss>`],
    [feeds[1].url, `<?xml version="1.0"?><rss><channel>
      <item><title>AI security third</title><link>https://other.example/c</link><pubDate>Thu, 03 Sep 2026 01:00:00 GMT</pubDate><description>LLM security.</description></item>
    </channel></rss>`],
  ]);
  const config = {
    collection: { windowDays: 7, maxCandidates: 2, timeoutMs: 1000, userAgent: 'test', minItems: 1, minOrigins: 1 },
    scopeKeywords: ['ai', 'llm', 'security'],
    feeds,
  };

  // When: collection is capped to two candidates.
  const result = await collectCandidates({
    config,
    published: { urls: new Set(), ids: new Set() },
    now,
    transport: async (url) => new Response(xmlByUrl.get(url), { status: 200 }),
  });

  // Then: the cap is filled across origins, not only by the freshest origin.
  assert.deepEqual(result.candidates.map((candidate) => candidate.origin), ['Fresh Lab', 'Other Lab']);
});

function candidate(candidateId, url, origin) {
  return {
    candidateId,
    title: `Title ${candidateId}`,
    url,
    publishedAt: '2026-09-03T00:00:00.000Z',
    source: 'release',
    origin,
    feedName: 'Fixture',
    excerpt: 'AI security update',
  };
}

function validDraft(plan, candidates) {
  return {
    number: plan.number,
    title: 'AI 보안 업데이트',
    date: plan.date,
    period: plan.period,
    intro: '이번 호는 AI 보안 업데이트를 묶음.',
    items: candidates.map((item, index) => ({
      candidateId: item.candidateId,
      id: `i${plan.number}-item-${index + 1}`,
      title: item.title,
      url: item.url,
      source: item.source,
      origin: item.origin,
      tags: ['ai-security'],
      summary: 'Fixture Lab이 2026년 AI 보안 업데이트를 공개함. 원문 기준으로 방어적 변화만 요약함.',
      note: null,
    })),
  };
}

test('Given an existing issue When publication repeats Then its bytes are preserved', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { publishIssue } = await import('../scripts/editorial/publish.mjs');
  // Given: an existing published issue in an isolated directory.
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dades-publish-'));
  const plan = { filename: 'issue-002.json' };
  const file = path.join(directory, plan.filename);
  await fs.writeFile(file, 'original issue\n');
  try {
    // When: a second publication attempts the same filename.
    await assert.rejects(publishIssue({ issuesDir: directory, plan, issue: { number: 2 } }), /refusing to overwrite/);
    // Then: original bytes and directory contents remain unchanged.
    assert.equal(await fs.readFile(file, 'utf8'), 'original issue\n');
    assert.deepEqual(await fs.readdir(directory), [plan.filename]);
  } finally {
    await fs.rm(directory, { recursive: true });
  }
});

test('Given a late KST run When an issue is planned Then its period covers the full collection window', () => {
  // Given: the calendar day in Seoul differs from UTC.
  const now = new Date('2026-09-06T16:00:00Z');
  // When: a ten-day rolling collection is labelled for publication.
  const plan = makeIssuePlan({ now, maxNumber: 999, windowDays: 10 });
  // Then: date and period use Seoul time, including the earliest allowed day.
  assert.equal(plan.date, '2026-09-07');
  assert.equal(plan.period, '08.28 – 09.07');
  assert.equal(plan.filename, 'issue-1000.json');
});
