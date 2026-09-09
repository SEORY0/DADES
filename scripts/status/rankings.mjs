import { numberOrNull } from './catalog.mjs';
import { flightRecords } from './flight.mjs';

export const RANKINGS_URL = 'https://openrouter.ai/rankings';

function catalogIdentities(catalog) {
  const candidates = new Map();
  for (const model of catalog?.data ?? []) {
    if (typeof model.id !== 'string' || model.id.startsWith('~') || typeof model.canonical_slug !== 'string') continue;
    const variant = model.id.includes(':') ? model.id.slice(model.id.indexOf(':')) : '';
    const key = `${model.canonical_slug}${variant}`;
    const ids = candidates.get(key) ?? [];
    ids.push(model.id);
    candidates.set(key, ids);
  }
  return new Map([...candidates].filter(([, ids]) => ids.length === 1).map(([key, ids]) => [key, ids[0]]));
}

export function parseRankings(html, catalog = null) {
  const records = flightRecords(html);
  const ranking = [...records.values()].map((value) => value?.[3]?.initialRanking).find((value) => value?.rankingType === 'week');
  const reference = /^\$([\da-f]+):props:state:queries:(\d+):state:data$/.exec(ranking?.rankingData ?? '');
  if (!reference) throw new Error('Published weekly ranking reference is unavailable.');
  const query = records.get(reference[1])?.[3]?.state?.queries?.[Number(reference[2])];
  if (query?.queryKey?.[0] !== 'rankings' || query.queryKey[1] !== 'models' || query.queryKey[2]?.view !== 'week' || !Array.isArray(query.state?.data) || !query.state.data.length) {
    throw new Error('Published ranking is not a populated seven-day model query.');
  }

  const identities = catalogIdentities(catalog);
  const byId = new Map();
  const dates = new Set();
  for (const row of query.state.data) {
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(row.date)) throw new Error('Ranking bucket date is unavailable.');
    dates.add(row.date.slice(0, 10));
    const variant = row.variant === 'standard' ? '' : `:${row.variant}`;
    if (typeof row.model_permaslug !== 'string' || typeof row.variant !== 'string' || row.variant_permaslug !== `${row.model_permaslug}${variant}`) throw new Error('Ranking variant identity is inconsistent.');
    const link = ranking.modelLinks?.[row.variant_permaslug] ?? (row.variant === 'standard' ? ranking.modelLinks?.[row.model_permaslug] : null);
    let id = identities.get(row.variant_permaslug);
    if (typeof link?.href === 'string') {
      const url = new URL(link.href, RANKINGS_URL);
      const linkedId = url.pathname.slice(1);
      const linkedVariant = linkedId.includes(':') ? linkedId.slice(linkedId.indexOf(':')) : '';
      if (url.origin !== 'https://openrouter.ai' || url.search || url.hash || !/^[\w.-]+\/[\w.:+-]+$/.test(linkedId) || linkedVariant !== variant) throw new Error('Ranking model link is invalid.');
      if (id && id !== linkedId) throw new Error('Ranking and catalog model identities disagree.');
      id = linkedId;
    }
    const prompt = numberOrNull(row.total_prompt_tokens);
    const completion = numberOrNull(row.total_completion_tokens);
    if (!Number.isSafeInteger(prompt) || !Number.isSafeInteger(completion) || !Number.isSafeInteger(prompt + completion)) throw new Error('Ranking token counts are unavailable or imprecise.');
    if (!id) continue;
    if (byId.has(id)) throw new Error('Ranking contains duplicate model identities.');
    byId.set(id, { tokens7d: prompt + completion, previousTokens7d: null, dailyTokens: [] });
  }
  if (dates.size !== 1 || byId.size === 0) throw new Error('Ranking has inconsistent dates or no mapped model identities.');
  const date = [...dates][0];
  const observedAt = `${date}T00:00:00.000Z`;
  if (new Date(observedAt).toISOString() !== observedAt) throw new Error('Ranking bucket date is invalid.');
  return {
    byId, observedAt,
    note: `Published seven-day OpenRouter prompt + completion tokens through ${date} (UTC daily buckets). ${byId.size}/${query.state.data.length} published ranking rows mapped; unlisted models are unknown, not zero. Private and provider-direct traffic are excluded. Previous-week totals and daily history are not supplied.`,
  };
}
