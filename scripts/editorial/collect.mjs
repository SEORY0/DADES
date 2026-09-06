import fs from 'node:fs/promises';
import path from 'node:path';
import { candidateSchema, configSchema } from './schema.mjs';

const ISSUE_RE = /^issue-(\d{3,})\.json$/;
const TRACKING_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
const AI_TERMS = ['ai', 'artificial intelligence', 'llm', 'large language model', 'language models', 'machine learning', 'deep learning', 'foundation model', 'neural network', 'generative', 'prompt injection', 'model context protocol', 'mcp', 'gpt', 'claude', 'gemini', '인공지능', '생성형', '언어 모델'];

export async function loadConfig(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  return configSchema.parse(JSON.parse(raw));
}

export async function readPublishedIssues(issuesDir) {
  const entries = await fs.readdir(issuesDir, { withFileTypes: true });
  const published = { maxNumber: 0, urls: new Set(), ids: new Set(), dates: new Set() };
  for (const entry of entries) {
    const match = entry.isFile() ? ISSUE_RE.exec(entry.name) : null;
    if (!match) continue;
    const issue = JSON.parse(await fs.readFile(path.join(issuesDir, entry.name), 'utf8'));
    published.maxNumber = Math.max(published.maxNumber, Number(issue.number ?? match[1]));
    if (typeof issue.date === 'string') published.dates.add(issue.date);
    for (const item of issue.items ?? []) {
      if (typeof item.url === 'string') published.urls.add(normalizeUrl(item.url));
      if (typeof item.id === 'string') published.ids.add(item.id);
    }
  }
  return published;
}

export function makeIssuePlan({ now, maxNumber, windowDays = 7 }) {
  const date = formatKstDate(now);
  const start = new Date(now.getTime() - windowDays * 86400000);
  const period = `${formatKstPeriod(start)} – ${formatKstPeriod(now)}`;
  return { number: maxNumber + 1, date, filename: `issue-${String(maxNumber + 1).padStart(3, '0')}.json`, period };
}

export async function collectCandidates({ config, published, now = new Date(), transport = fetch }) {
  const since = new Date(now.getTime() - config.collection.windowDays * 86400000);
  const results = [];
  const diagnostics = [];

  for (const feed of config.feeds) {
    try {
      const xml = await fetchText(feed, config.collection, transport);
      const entries = parseFeed(xml, feed);
      diagnostics.push({ feed: feed.name, status: 'ok', entries: entries.length });
      results.push(...entries);
    } catch (error) {
      diagnostics.push({ feed: feed.name, status: 'error', error: error.message });
    }
  }

  const eligible = [];
  for (const entry of results.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const publishedAt = new Date(entry.publishedAt);
    if (Number.isNaN(publishedAt.valueOf()) || publishedAt > now || publishedAt < since) continue;
    if (published.urls.has(entry.url)) continue;
    if (!isInScope(entry, config.scopeKeywords)) continue;
    eligible.push(entry);
  }

  const seen = new Set();
  const candidates = [];
  for (const entry of diversifyByOrigin(eligible)) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    candidates.push(candidateSchema.parse({ ...entry, candidateId: `c${candidates.length + 1}` }));
    if (candidates.length >= config.collection.maxCandidates) break;
  }

  return { candidates, diagnostics };
}

export function parseFeed(xml, feed) {
  const blocks = blocksFor(xml, 'item').concat(blocksFor(xml, 'entry'));
  return blocks.flatMap((block) => {
    try {
      const title = cleanText(textFor(block, 'title'));
      const link = cleanText(attrFor(block, 'link', 'href') || textFor(block, 'link') || textFor(block, 'guid'));
      const dateText = cleanText(textFor(block, 'pubDate') || textFor(block, 'updated') || textFor(block, 'published') || textFor(block, 'dc:date'));
      if (!title || !link || !dateText) return [];
      const normalized = normalizeUrl(link);
      const url = new URL(normalized);
      if (!feed.allowHosts.includes(url.hostname)) return [];
      return [{
        title,
        url: normalized,
        publishedAt: new Date(dateText).toISOString(),
        source: feed.source,
        origin: feed.origin,
        feedName: feed.name,
        excerpt: cleanText(textFor(block, 'description') || textFor(block, 'summary') || textFor(block, 'content:encoded')).slice(0, 700),
      }];
    } catch {
      return [];
    }
  });
}

export function normalizeUrl(input) {
  const url = new URL(decodeEntities(input.trim()));
  if (url.protocol !== 'https:') throw new Error(`non-HTTPS URL skipped: ${input}`);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}

function isInScope(entry, keywords) {
  const haystack = `${entry.title} ${entry.excerpt}`.toLowerCase();
  return AI_TERMS.some((keyword) => matchesKeyword(haystack, keyword)) && keywords.some((keyword) => matchesKeyword(haystack, keyword));
}

async function fetchText(feed, collection, transport) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), collection.timeoutMs);
  try {
    const response = await transport(feed.url, {
      signal: controller.signal,
      headers: { 'user-agent': collection.userAgent, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${feed.url}`);
    const finalUrl = new URL(response.url || feed.url);
    if (finalUrl.protocol !== 'https:' || !feed.allowHosts.includes(finalUrl.hostname)) {
      throw new Error(`redirected outside allowlist: ${finalUrl.toString()}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function diversifyByOrigin(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const group = groups.get(entry.origin) ?? [];
    group.push(entry);
    groups.set(entry.origin, group);
  }
  const orderedGroups = [...groups.values()].sort((a, b) => b[0].publishedAt.localeCompare(a[0].publishedAt));
  const diversified = [];
  for (let index = 0; orderedGroups.some((group) => index < group.length); index += 1) {
    for (const group of orderedGroups) {
      if (group[index]) diversified.push(group[index]);
    }
  }
  return diversified;
}

function matchesKeyword(haystack, keyword) {
  const lower = keyword.toLowerCase();
  if (/^[a-z0-9 ]+$/.test(lower)) {
    return new RegExp(`\\b${escapeRegExp(lower)}\\b`, 'i').test(haystack);
  }
  return haystack.includes(lower);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blocksFor(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'))].map((match) => match[0]);
}

function textFor(block, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return match ? decodeEntities(stripCdata(match[1]).replace(/<[^>]*>/g, ' ')) : '';
}

function attrFor(block, tag, attr) {
  const match = new RegExp(`<${tag}\\b[^>]*\\s${attr}=["']([^"']+)["'][^>]*\\/?>`, 'i').exec(block);
  return match ? decodeEntities(match[1]) : '';
}

function stripCdata(value) {
  return value.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
}

function cleanText(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatKstDate(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', dateStyle: 'short' }).format(date);
}

function formatKstPeriod(date) {
  const parts = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).format(date);
  return parts.replace(/\.$/, '').replace(/\. /g, '.');
}
