import { CATALOG_URL, parseCatalog } from './catalog.mjs';
import { parseRankings, RANKINGS_URL } from './rankings.mjs';
import { matchTerminalBench, parseTerminalBench, TERMINAL_BENCH_URL } from './terminal-bench.mjs';
import { EMPTY_PERFORMANCE, parseModelPage, performanceSample } from './performance.mjs';

export const SCHEMA_VERSION = 2;
const SOURCE_DETAILS = [
  { id: 'openrouter-catalog', label: 'OpenRouter catalog', url: CATALOG_URL },
  { id: 'artificial-analysis', label: 'Artificial Analysis via OpenRouter', url: CATALOG_URL },
  { id: 'terminal-bench', label: 'Terminal-Bench 4.0 leaderboard', url: TERMINAL_BENCH_URL },
  { id: 'openrouter-performance', label: 'OpenRouter model page performance', url: 'https://openrouter.ai/models' },
  { id: 'openrouter-usage', label: 'OpenRouter usage rankings', url: RANKINGS_URL },
];
const ALLOWED_HOSTS = new Set(['openrouter.ai', 'www.tbench.ai']);
const PERFORMANCE_FIELDS = ['speed', 'latency', 'speedProvider', 'speedRequests', 'speedWindow'];
const USAGE_FIELDS = ['tokens7d', 'previousTokens7d', 'dailyTokens'];
const BENCHMARK_FIELDS = ['intelligence', 'coding', 'agentic'];
const TERMINAL_BENCH_FIELDS = ['terminalBench'];

export async function fetchSource(url, transport = fetch) {
  const json = url.startsWith('https://openrouter.ai/api/');
  const response = await transport(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: json ? 'application/json' : 'text/html', 'user-agent': 'DADES-Model-Board/2.0 (+https://seory0.github.io/DADES/)' },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== new URL(url).hostname || !ALLOWED_HOSTS.has(finalUrl.hostname)) throw new Error('Upstream redirected outside the source domain.');
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Source exceeded the response size limit.');
  return json ? JSON.parse(text) : text;
}

export function upgradeSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.models) || !Array.isArray(snapshot.sources)) throw new Error('Existing status snapshot has an unsupported format.');
  if (snapshot.schemaVersion === SCHEMA_VERSION) return snapshot;
  if (snapshot.schemaVersion !== 1) throw new Error('Existing status snapshot has an unsupported format.');
  return { ...snapshot, schemaVersion: SCHEMA_VERSION, terminalBench: null, models: snapshot.models.map((model) => ({ terminalBench: null, speedRequests: null, speedWindow: null, ...model })) };
}

function keepFields(models, previous, fields) {
  const oldModels = new Map((previous?.models ?? []).map((model) => [model.id, model]));
  for (const model of models) {
    const old = oldModels.get(model.id);
    if (old) for (const field of fields) model[field] = structuredClone(old[field] ?? null);
  }
}

async function fetchWithRetry(url, transport) {
  try {
    return await fetchSource(url, transport);
  } catch {
    return fetchSource(url, transport);
  }
}

async function collectPerformance(models, transport) {
  const observations = new Map();
  for (let index = 0; index < models.length; index += 4) {
    const batch = models.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async (model) => parseModelPage(await fetchWithRetry(model.url, transport), model.id)));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    results.forEach((result, offset) => observations.set(batch[offset].id, result.value));
  }
  return observations;
}

export async function refreshSnapshot({ previous = null, transport = fetch, now = new Date(), aliases = {} } = {}) {
  const fetchedAt = now.toISOString();
  const sources = SOURCE_DETAILS.map((details) => ({ ...details, observedAt: previous?.sources.find((source) => source.id === details.id)?.observedAt ?? null, status: 'unavailable', note: '' }));
  const source = (id) => sources.find((entry) => entry.id === id);
  const results = await Promise.allSettled([fetchSource(CATALOG_URL, transport), fetchSource(RANKINGS_URL, transport), fetchSource(TERMINAL_BENCH_URL, transport)]);
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

  let terminalBench = previous?.terminalBench ?? null;
  try {
    if (results[2].status === 'rejected') throw results[2].reason;
    const matched = matchTerminalBench(parseTerminalBench(results[2].value), models, aliases.terminalBench ?? {});
    for (const model of models) model.terminalBench = matched.byId.get(model.id) ?? null;
    terminalBench = { title: matched.title, url: matched.url, updatedAt: matched.updatedAt, rows: matched.rows };
    Object.assign(source('terminal-bench'), { status: 'ok', observedAt: matched.updatedAt, note: `${matched.mapped}/${matched.rows.length} published Terminal-Bench 4.0 rows map to catalog models; each model keeps its best accuracy across agents and reasoning efforts, and unmapped rows stay in the board list only. Results depend on the agent harness. Leaderboard updated ${matched.updatedAt.slice(0, 10)} UTC.` });
  } catch (error) {
    keepFields(models, previous, TERMINAL_BENCH_FIELDS);
    source('terminal-bench').note = `Terminal-Bench leaderboard could not be refreshed; retained the last successful observations, if any. ${error.message}`;
  }

  try {
    if (!payload) throw new Error('Current catalog is unavailable, so model page sampling was skipped.');
    const sample = performanceSample(models);
    const observations = await collectPerformance(sample, transport);
    const measured = [...observations.values()].filter((observation) => observation.speed !== null).length;
    if (!measured) throw new Error(`No provider throughput was published for the ${sample.length} sampled model pages.`);
    for (const model of models) Object.assign(model, observations.get(model.id) ?? EMPTY_PERFORMANCE);
    Object.assign(source('openrouter-performance'), { status: 'ok', observedAt: fetchedAt, note: `${measured}/${sample.length} sampled models publish provider p50 statistics on their OpenRouter pages. Sample combines leading intelligence and usage models. Each value is the p50 output tokens/second and p50 latency of the standard endpoint with the most requests in the published window, not a provider average.` });
  } catch (error) {
    keepFields(models, previous, PERFORMANCE_FIELDS);
    source('openrouter-performance').note = `Performance p50 unavailable; retained last successful observations, if any, at their earlier timestamp. ${error.message}`;
  }

  return { schemaVersion: SCHEMA_VERSION, fetchedAt, sources, terminalBench, models };
}
