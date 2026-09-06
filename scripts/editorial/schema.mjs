import { z } from 'zod';

export const SOURCE_KEYS = ['news', 'repo', 'paper', 'sns', 'release', 'tool', 'read'];
export const SIGNAL_KEYS = ['action', 'noise'];

const feedSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'feed URLs must use HTTPS'),
  source: z.enum(SOURCE_KEYS),
  origin: z.string().min(1),
  allowHosts: z.array(z.string().min(1)).min(1),
});

export const configSchema = z.object({
  anthropic: z.object({
    model: z.string().min(1),
    maxOutputTokens: z.number().int().positive().max(4096),
    timeoutMs: z.number().int().positive().max(120000),
  }),
  collection: z.object({
    windowDays: z.number().int().positive().max(31),
    maxCandidates: z.number().int().positive().max(50),
    maxItems: z.number().int().positive().max(8),
    minItems: z.number().int().positive().max(12),
    minOrigins: z.number().int().positive().max(12),
    timeoutMs: z.number().int().positive().max(60000),
    userAgent: z.string().min(1),
  }),
  scopeKeywords: z.array(z.string().min(2)).min(1),
  feeds: z.array(feedSchema).min(1),
});

export const candidateSchema = z.object({
  candidateId: z.string().regex(/^c[0-9]+$/),
  title: z.string().min(1).max(180),
  url: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'candidate URLs must use HTTPS'),
  publishedAt: z.string().datetime(),
  source: z.enum(SOURCE_KEYS),
  origin: z.string().min(1),
  feedName: z.string().min(1),
  excerpt: z.string().default(''),
});

const issueItemSchema = z.object({
  candidateId: z.string().regex(/^c[0-9]+$/),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(180),
  url: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'item URLs must use HTTPS'),
  source: z.enum(SOURCE_KEYS),
  origin: z.string().min(1),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(6).default([]),
  summary: z.string().min(20).max(420),
  note: z.string().max(180).nullable().default(null),
  signal: z.enum(SIGNAL_KEYS).optional(),
});

export const issueDraftSchema = z.object({
  number: z.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.string().min(1),
  intro: z.string().min(1).max(280),
  items: z.array(issueItemSchema).min(1).max(8),
});

export function toIssueJson(draft) {
  return {
    number: draft.number,
    title: draft.title,
    date: draft.date,
    period: draft.period,
    intro: draft.intro,
    items: draft.items.map(({ candidateId, ...item }) => item),
  };
}

export function validateDraft({ draft, candidates, published, plan, quality }) {
  const parsed = issueDraftSchema.parse(draft);
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const errors = [];
  const seenUrls = new Set();
  const seenIds = new Set(published.ids);
  const itemOrigins = new Set();

  if (parsed.number !== plan.number) errors.push(`expected issue number ${plan.number}`);
  if (parsed.date !== plan.date) errors.push(`expected issue date ${plan.date}`);
  if (parsed.items.length < quality.minItems) errors.push(`need at least ${quality.minItems} items`);

  for (const item of parsed.items) {
    const candidate = candidateById.get(item.candidateId);
    if (!candidate) {
      errors.push(`${item.id} uses unknown candidate ${item.candidateId}`);
      continue;
    }
    if (item.url !== candidate.url) errors.push(`${item.id} changed source URL`);
    if (item.source !== candidate.source) errors.push(`${item.id} changed source type`);
    if (item.origin !== candidate.origin) errors.push(`${item.id} changed origin`);
    if (published.urls.has(item.url)) errors.push(`${item.id} duplicates a published URL`);
    if (seenUrls.has(item.url)) errors.push(`${item.id} duplicates another item URL`);
    if (seenIds.has(item.id)) errors.push(`${item.id} is not globally unique`);
    if (!item.id.startsWith(`i${plan.number}-`)) errors.push(`${item.id} has wrong issue prefix`);
    seenUrls.add(item.url);
    seenIds.add(item.id);
    itemOrigins.add(item.origin);
  }

  if (itemOrigins.size < quality.minOrigins) errors.push(`need at least ${quality.minOrigins} origins`);
  if (errors.length > 0) throw new Error(`Editorial draft failed validation: ${errors.join('; ')}`);
  return parsed;
}
