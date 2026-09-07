import { CATALOG_URL, endpointRequests, parseCatalog, parseEndpoint } from './catalog.mjs';
import { parseRankings, RANKINGS_URL } from './rankings.mjs';

const SOURCE_DETAILS = [
  { id: 'openrouter-catalog', label: 'OpenRouter catalog', url: CATALOG_URL },
  { id: 'artificial-analysis', label: 'Artificial Analysis via OpenRouter', url: CATALOG_URL },
  { id: 'openrouter-performance', label: 'OpenRouter endpoint performance', url: 'https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model' },
  { id: 'openrouter-usage', label: 'OpenRouter usage rankings', url: RANKINGS_URL },
];
const PERFORMANCE_FIELDS = ['speed', 'latency', 'speedProvider'];
const USAGE_FIELDS = ['tokens7d', 'previousTokens7d', 'dailyTokens'];
const BENCHMARK_FIELDS = ['intelligence', 'coding', 'agentic'];

export async function fetchSource(url, transport = fetch) {
  const response = await transport(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: url === RANKINGS_URL ? 'text/html' : 'application/json', 'user-agent': 'DADES-Model-Board/1.0 (+https://seory0.github.io/DADES/)' },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'openrouter.ai') throw new Error('Upstream redirected outside the source domain.');
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Source exceeded the response size limit.');
  return url === RANKINGS_URL ? text : JSON.parse(text);
}

function keepFields(models, previous, fields) {
  const oldModels = new Map((previous?.models ?? []).map((model) => [model.id, model]));
  for (const model of models) {
    const old = oldModels.get(model.id);
    if (old) for (const field of fields) model[field] = structuredClone(old[field]);
  }
}

function performanceSample(payload, models) {
  const eligible = models.filter((model) => !model.id.includes(':') && !model.id.startsWith('~'));
  const byMetric = (key) => eligible.filter((model) => model[key] !== null).sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id));
  const intelligence = byMetric('intelligence');
  const usage = byMetric('tokens7d');
  const candidates = [...intelligence.slice(0, 16), ...usage.slice(0, 16), ...intelligence, ...eligible];
  const seen = new Set();
  return endpointRequests(payload, candidates).filter((request) => {
    if (seen.has(request.canonical)) return false;
    seen.add(request.canonical);
    return true;
  }).slice(0, 32);
}

async function collectPerformance(requests, transport) {
  const observations = new Map();
  for (let index = 0; index < requests.length; index += 4) {
    const batch = requests.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async (request) => parseEndpoint(await fetchSource(request.url, transport), request)));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    results.forEach((result, offset) => observations.set(batch[offset].id, result.value));
  }
  return observations;
}

export async function refreshSnapshot({ previous = null, transport = fetch, now = new Date() } = {}) {
  const fetchedAt = now.toISOString();
  const sources = SOURCE_DETAILS.map((details) => ({ ...details, observedAt: previous?.sources.find((source) => source.id === details.id)?.observedAt ?? null, status: 'unavailable', note: '' }));
  const source = (id) => sources.find((entry) => entry.id === id);
  const results = await Promise.allSettled([fetchSource(CATALOG_URL, transport), fetchSource(RANKINGS_URL, transport)]);
  let payload = null;
  let models;
  try {
    if (results[0].status === 'rejected') throw results[0].reason;
    payload = results[0].value;
    models = parseCatalog(payload);
    Object.assign(source('openrouter-catalog'), { status: 'ok', observedAt: fetchedAt, note: `${models.length} text-output OpenRouter entries, including aliases and variants; not the whole market. Base prices are USD per million tokens; provider and context-tier prices can differ.` });
  } catch (error) {
    payload = null;
    if (!previous?.models?.length) throw new Error(`No usable catalog or previous snapshot: ${error.message}`);
    models = structuredClone(previous.models);
    source('openrouter-catalog').note = `Catalog refresh failed; retained the last successful catalog. ${error.message}`;
  }

  if (payload && models.some((model) => BENCHMARK_FIELDS.some((field) => model[field] !== null))) {
    Object.assign(source('artificial-analysis'), { status: 'ok', observedAt: fetchedAt, note: 'Artificial Analysis intelligence, coding, and agentic indices as forwarded by OpenRouter. Original scales, not percentages or a DADES aggregate. Missing evaluations remain null.' });
  } else {
    keepFields(models, previous, BENCHMARK_FIELDS);
    source('artificial-analysis').note = 'The refreshed catalog did not supply usable benchmark indices. Last successful observations, if any, are retained at their earlier timestamp.';
  }

  try {
    if (results[1].status === 'rejected') throw results[1].reason;
    const rankings = parseRankings(results[1].value, payload);
    for (const model of models) {
      const usage = rankings.byId.get(model.id);
      Object.assign(model, usage ?? { tokens7d: null, previousTokens7d: null, dailyTokens: [] });
    }
    Object.assign(source('openrouter-usage'), { status: 'ok', observedAt: rankings.observedAt, note: rankings.note });
  } catch (error) {
    keepFields(models, previous, USAGE_FIELDS);
    source('openrouter-usage').note = `Published usage could not be refreshed; last successful observations, if any, are retained. No history is estimated. ${error.message}`;
  }

  try {
    if (!payload) throw new Error('Current catalog is unavailable, so endpoint sampling was skipped.');
    const requests = performanceSample(payload, models);
    const observations = await collectPerformance(requests, transport);
    const measured = [...observations.values()].filter((observation) => observation.speed !== null).length;
    if (!measured) throw new Error(`No throughput p50 observations were published for the ${requests.length} sampled models.`);
    for (const model of models) Object.assign(model, observations.get(model.id) ?? { speed: null, latency: null, speedProvider: null });
    Object.assign(source('openrouter-performance'), { status: 'ok', observedAt: fetchedAt, note: `${measured}/${requests.length} sampled models expose last-30-minute p50 provider observations. Sample combines leading intelligence and usage models. Output tokens/second and latency seconds both use the published p50 from one alphabetically selected provider endpoint, not a provider average.` });
  } catch (error) {
    keepFields(models, previous, PERFORMANCE_FIELDS);
    source('openrouter-performance').note = `Performance p50 unavailable; retained last successful observations, if any, at their earlier timestamp. ${error.message}`;
  }

  return { schemaVersion: 1, fetchedAt, sources, models };
}
