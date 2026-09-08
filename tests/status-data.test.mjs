import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { endpointRequests, numberOrNull, parseCatalog, parseEndpoint } from '../scripts/status/catalog.mjs';
import { fetchSource, refreshSnapshot } from '../scripts/status/refresh.mjs';
import { parseRankings } from '../scripts/status/rankings.mjs';
import { findInRecords, flightRecords } from '../scripts/status/flight.mjs';
import { matchTerminalBench, parseTerminalBench } from '../scripts/status/terminal-bench.mjs';

const tbenchHtml = await readFile(new URL('./fixtures/status/tbench-4.0.html', import.meta.url), 'utf8');

function terminalBenchHtml({ name = '4-0-0', title = 'Terminal-Bench 4.0', rows = [] } = {}) {
  const record = ['$', '$L1e', null, { state: { queries: [{ queryKey: ['leaderboard'], state: { data: { leaderboard: { title, name, updated_at: '2026-09-03T21:34:07.080891+00:00' }, rows } } }] } }];
  return `<script>self.__next_f.push(${JSON.stringify([1, `1d:${JSON.stringify(record)}\n`])})</script>`;
}
const tbRow = (overrides = {}) => ({
  rank: 1,
  metadata: { date: '2026-09-03', model_display: { label: 'Example Model', url: 'https://example.com/model' }, agent_display: { label: 'Example Agent', url: 'https://example.com/agent' }, agent_org: { label: 'Example' }, model_org: { label: 'Example' }, reasoning_effort: 'high' },
  metrics: { accuracy: 42.5, accuracy_ci95_half_width: 3, n_trials: 330 },
  ...overrides,
});
const tbMeta = (overrides) => ({ ...tbRow().metadata, ...overrides });

const catalogRow = (overrides = {}) => ({
  id: 'example/model', name: 'Example: Model', canonical_slug: 'example/model-20260101',
  architecture: { output_modalities: ['text'] }, context_length: 128000,
  pricing: { prompt: '0.0000025', completion: '0' },
  benchmarks: { artificial_analysis: { intelligence_index: 123.4, coding_index: 57, agentic_index: null } },
  links: { details: '/api/v1/models/example/model-20260101/endpoints' }, ...overrides,
});

function flightHtml(stream, splitAt = 7) {
  return [stream.slice(0, splitAt), stream.slice(splitAt)].map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('<script>self.__next_f.push([0])</script>');
}

test('flight parser joins split push chunks into JSON records and skips transport lines', () => {
  const records = flightRecords(flightHtml('1:"$Sreact.fragment"\na:{"state":{"queries":[{"queryKey":["x"],"state":{"data":[1,2]}}]}}\nb:I[123,[]]\n'));
  assert.deepEqual([...records.keys()], ['a']);
  assert.deepEqual(findInRecords(records, (value) => Array.isArray(value.queryKey)).state.data, [1, 2]);
  assert.equal(findInRecords(records, (value) => value.missing === true), null);
  assert.throws(() => flightRecords(null), /not HTML/);
});

test('catalog preserves published benchmark scale and converts token prices to USD per million', () => {
  const [model] = parseCatalog({ data: [catalogRow()] });
  assert.deepEqual([model.inputPrice, model.outputPrice, model.intelligence, model.coding, model.agentic], [2.5, 0, 123.4, 57, null]);
});

test('catalog retains stable variant IDs and only includes text-output records', () => {
  const models = parseCatalog({ data: [catalogRow(), catalogRow({ id: '~example/model:free' }), catalogRow({ id: 'example/image', architecture: { output_modalities: ['image'] } })] });
  assert.deepEqual(new Set(models.map((model) => model.id)), new Set(['example/model', '~example/model:free']));
});

test('catalog groups the same provider namespace despite display-name differences and aliases', () => {
  const rows = [
    catalogRow({ id: 'anthropic/claude-sonnet-5', name: 'Anthropic: Claude Sonnet 5' }),
    catalogRow({ id: 'anthropic/claude-opus-5', name: 'Claude Opus 5' }),
    catalogRow({ id: '~anthropic/claude-latest', name: 'anthropic: Claude Latest' }),
  ];
  assert.deepEqual(parseCatalog({ data: rows }).map((model) => model.provider), ['Anthropic', 'Anthropic', 'Anthropic']);
});

test('catalog uses canonical display labels for known namespaces and stable namespaces for unknown authors', () => {
  const expected = new Map([['openai', 'OpenAI'], ['google', 'Google'], ['meta-llama', 'Meta'], ['meta', 'Meta'], ['bytedance-seed', 'ByteDance'], ['bytedance', 'ByteDance'], ['deepseek', 'DeepSeek'], ['qwen', 'Qwen'], ['new-author', 'new-author']]);
  const rows = [...expected].map(([provider]) => catalogRow({ id: `${provider}/model`, name: 'Unrelated: Model Name' }));
  for (const model of parseCatalog({ data: rows })) assert.equal(model.provider, expected.get(model.id.split('/')[0]));
});

test('unknown and invalid numbers remain null while zero is retained', () => {
  for (const value of [null, undefined, '', ' ', -1, '-1', true, false, 'Infinity', Infinity, NaN, {}, 'abc']) assert.equal(numberOrNull(value), null);
  for (const value of ['0', 0]) assert.equal(numberOrNull(value), 0);
});

test('catalog rejects duplicate identities and an empty text catalog', () => {
  assert.throws(() => parseCatalog({ data: [catalogRow(), catalogRow()] }), /duplicate/);
  assert.throws(() => parseCatalog({ data: [catalogRow({ architecture: { output_modalities: ['image'] } })] }), /no text-output/);
});

test('catalog refuses a truncated upstream page instead of dropping existing models', () => {
  assert.throws(() => parseCatalog({ data: [catalogRow()], total_count: 2 }), /incomplete/);
  assert.throws(() => parseCatalog({ data: [catalogRow()], links: { next: '/api/v1/models?page=2' } }), /incomplete/);
});

test('performance requests only follow published matching HTTPS details links', () => {
  const good = catalogRow();
  const foreign = catalogRow({ id: 'example/foreign', links: { details: 'https://other.example/api/v1/models/example/model-20260101/endpoints' } });
  const wrong = catalogRow({ id: 'example/wrong', links: { details: '/api/v1/models/example/different/endpoints' } });
  const payload = { data: [good, foreign, wrong] };
  assert.deepEqual(endpointRequests(payload, parseCatalog(payload)), [{ id: good.id, canonical: good.canonical_slug, url: 'https://openrouter.ai/api/v1/models/example/model-20260101/endpoints' }]);
});

test('performance uses speed and latency from one named endpoint without mixing providers', () => {
  const request = { id: 'example/model', canonical: 'example/model-20260101' };
  const data = { id: request.canonical, endpoints: [
    { model_id: request.canonical, provider_name: 'Zulu', throughput_last_30m: { p50: 900 }, latency_last_30m: { p50: 0.2 } },
    { model_id: request.canonical, provider_name: 'Alpha', throughput_last_30m: { p50: 31 }, latency_last_30m: { p50: 4 } },
  ] };
  assert.deepEqual(parseEndpoint({ data }, request), { speed: 31, latency: 4, speedProvider: 'Alpha' });
});

test('performance reads the documented p50 percentile from both endpoint metrics', () => {
  const request = { id: 'openai/gpt-4', canonical: 'openai/gpt-4' };
  const data = { id: request.id, endpoints: [{
    model_id: request.id, provider_name: 'OpenAI', tag: 'openai',
    throughput_last_30m: { p50: 45.2, p75: 38.5, p90: 28.3, p99: 15.1 },
    latency_last_30m: { p50: 0.25, p75: 0.35, p90: 0.48, p99: 0.85 },
  }] };
  assert.deepEqual(parseEndpoint({ data }, request), { speed: 45.2, latency: 0.25, speedProvider: 'OpenAI (openai)' });
});

test('performance leaves a missing p50 unknown instead of substituting another percentile', () => {
  const request = { id: 'example/model', canonical: 'example/model' };
  const data = { id: request.id, endpoints: [{
    model_id: request.id, provider_name: 'Example',
    throughput_last_30m: { p75: 38.5 }, latency_last_30m: { p50: 0.25 },
  }] };
  assert.deepEqual(parseEndpoint({ data }, request), { speed: null, latency: null, speedProvider: null });
});

test('performance rejects model mismatch and treats missing throughput as unavailable', () => {
  const request = { id: 'example/model', canonical: 'example/model-20260101' };
  assert.throws(() => parseEndpoint({ data: { id: 'other/model', endpoints: [] } }, request), /mismatch/);
  assert.deepEqual(parseEndpoint({ data: { id: request.id, endpoints: [{ model_id: request.id, provider_name: 'Alpha', throughput_last_30m: null, latency_last_30m: { p50: 0.2 } }] } }, request), { speed: null, latency: null, speedProvider: null });
});

function previousSnapshot() {
  const observedAt = '2026-09-01T00:00:00.000Z';
  return {
    schemaVersion: 1, fetchedAt: observedAt,
    sources: ['openrouter-catalog', 'artificial-analysis', 'openrouter-performance', 'openrouter-usage'].map((id) => ({ id, label: id, url: 'https://openrouter.ai/rankings', status: 'ok', observedAt, note: '' })),
    models: parseCatalog({ data: [catalogRow()] }).map((model) => ({ ...model, intelligence: 40, speed: 55, latency: 1.2, speedProvider: 'Example Cloud', tokens7d: 1000, previousTokens7d: 800, dailyTokens: [{ date: '2026-08-31', tokens: 1000 }] })),
  };
}

test('a partial outage refreshes catalog values while retaining failed sources and timestamps', async () => {
  const previous = previousSnapshot();
  const transport = async (url) => url === 'https://openrouter.ai/api/v1/models'
    ? new Response(JSON.stringify({ data: [catalogRow({ pricing: { prompt: '0.000004', completion: '0.000008' } })] }))
    : new Response('Unavailable', { status: 503 });
  const result = await refreshSnapshot({ previous, transport, now: new Date('2026-09-07T00:00:00.000Z') });
  assert.deepEqual([result.models[0].inputPrice, result.models[0].outputPrice, result.models[0].intelligence], [4, 8, 123.4]);
  for (const field of ['tokens7d', 'previousTokens7d', 'dailyTokens', 'speed', 'latency', 'speedProvider']) assert.deepEqual(result.models[0][field], previous.models[0][field]);
  for (const id of ['openrouter-performance', 'openrouter-usage']) {
    const source = result.sources.find((entry) => entry.id === id);
    assert.equal(source.status, 'unavailable');
    assert.equal(source.observedAt, previous.fetchedAt);
  }
  assert.equal(result.sources.find((entry) => entry.id === 'openrouter-catalog').observedAt, result.fetchedAt);
});

test('a complete upstream outage keeps the full last successful dataset', async () => {
  const previous = previousSnapshot();
  const result = await refreshSnapshot({ previous, transport: async () => new Response('', { status: 502 }), now: new Date('2026-09-07T00:00:00.000Z') });
  assert.deepEqual(result.models, previous.models);
  assert.ok(result.sources.every((source) => source.status === 'unavailable' && source.observedAt === previous.fetchedAt));
  assert.equal(result.fetchedAt, '2026-09-07T00:00:00.000Z');
});

test('missing benchmark feed preserves earlier indices without marking them fresh', async () => {
  const previous = previousSnapshot();
  const transport = async (url) => url === 'https://openrouter.ai/api/v1/models'
    ? new Response(JSON.stringify({ data: [catalogRow({ benchmarks: {} })] })) : new Response('', { status: 503 });
  const result = await refreshSnapshot({ previous, transport });
  assert.equal(result.models[0].intelligence, 40);
  const source = result.sources.find((entry) => entry.id === 'artificial-analysis');
  assert.equal(source.status, 'unavailable');
  assert.equal(source.observedAt, previous.fetchedAt);
});

test('first refresh fails without a usable catalog instead of publishing an empty board', async () => {
  await assert.rejects(refreshSnapshot({ transport: async () => new Response('', { status: 503 }) }), /No usable catalog/);
});

test('source adapter passes a timeout signal and rejects a foreign redirect', async () => {
  await assert.rejects(fetchSource('https://openrouter.ai/api/v1/models', async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, url: 'https://foreign.example/catalog', text: async () => '{}' };
  }), /outside the source domain/);
});

const rankingRow = (overrides = {}) => ({
  date: '2026-09-06 00:00:00', model_permaslug: 'example/model-20260101', variant_permaslug: 'example/model-20260101', variant: 'standard',
  total_prompt_tokens: 800, total_completion_tokens: 200, change: 0.5, ...overrides,
});

function rankingsHtml({ rows = [rankingRow()], view = 'week', links = { 'example/model-20260101': { href: '/example/model' } } } = {}) {
  const query = { queryKey: ['rankings', 'models', { view }], state: { data: rows } };
  const state = ['$', '$State', null, { state: { queries: [query] } }];
  const rank = ['$', '$Rank', null, { initialRanking: { rankingType: 'week', rankingData: '$a:props:state:queries:0:state:data', modelLinks: links } }];
  const stream = `a:${JSON.stringify(state)}\nb:${JSON.stringify(rank)}\n`;
  return [stream.slice(0, 101), stream.slice(101)].map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('');
}

test('weekly rankings sum published prompt and completion counts without inventing prior totals or history', () => {
  const result = parseRankings(rankingsHtml());
  assert.deepEqual(result.byId.get('example/model'), { tokens7d: 1000, previousTokens7d: null, dailyTokens: [] });
  assert.equal(result.observedAt, '2026-09-06T00:00:00.000Z');
});

test('weekly rankings use exact canonical catalog identities when page links are absent', () => {
  const result = parseRankings(rankingsHtml({ links: {} }), { data: [catalogRow()] });
  assert.equal(result.byId.get('example/model').tokens7d, 1000);
});

test('weekly rankings keep free variants separate from standard routes', () => {
  const free = rankingRow({ variant: 'free', variant_permaslug: 'example/model-20260101:free' });
  const result = parseRankings(rankingsHtml({ rows: [free], links: { 'example/model-20260101:free': { href: '/example/model:free' } } }));
  assert.equal(result.byId.get('example/model:free').tokens7d, 1000);
  assert.equal(result.byId.has('example/model'), false);
});

test('weekly rankings reject a daily query, inconsistent identity, and imprecise totals', () => {
  assert.throws(() => parseRankings(rankingsHtml({ view: 'day' })), /seven-day/);
  assert.throws(() => parseRankings(rankingsHtml(), { data: [catalogRow({ id: 'example/different' })] }), /identities disagree/);
  assert.throws(() => parseRankings(rankingsHtml({ rows: [rankingRow({ total_prompt_tokens: Number.MAX_SAFE_INTEGER })] })), /imprecise/);
});

test('a usable usage source refreshes independently when performance has no observations', async () => {
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/rankings') return new Response(rankingsHtml());
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow()] }));
    return new Response(JSON.stringify({ data: { id: 'example/model', endpoints: [] } }));
  };
  const result = await refreshSnapshot({ transport });
  assert.equal(result.models[0].tokens7d, 1000);
  assert.equal(result.models[0].speed, null);
  assert.equal(result.sources.find((source) => source.id === 'openrouter-usage').status, 'ok');
  assert.equal(result.sources.find((source) => source.id === 'openrouter-performance').status, 'unavailable');
});

test('one failed performance endpoint retains the entire earlier measurement batch', async () => {
  const previous = previousSnapshot();
  const second = catalogRow({ id: 'example/second', canonical_slug: 'example/second-20260101', links: { details: '/api/v1/models/example/second-20260101/endpoints' } });
  previous.models.push({ ...parseCatalog({ data: [second] })[0], speed: 66, latency: 2, speedProvider: 'Second Cloud' });
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow(), second] }));
    if (url.endsWith('/example/model-20260101/endpoints')) return new Response(JSON.stringify({ data: { id: 'example/model', endpoints: [{ model_id: 'example/model', provider_name: 'New Cloud', throughput_last_30m: { p50: 999 }, latency_last_30m: { p50: 0.1 } }] } }));
    return new Response('', { status: 503 });
  };
  const result = await refreshSnapshot({ previous, transport });
  assert.deepEqual(result.models.map((model) => model.speed), [55, 66]);
  assert.equal(result.sources.find((source) => source.id === 'openrouter-performance').observedAt, previous.fetchedAt);
});

test('terminal-bench parser reads the published 4.0 leaderboard rows with their agent and confidence interval', () => {
  const board = parseTerminalBench(tbenchHtml);
  assert.equal(board.title, 'Terminal-Bench 4.0');
  assert.equal(board.url, 'https://www.tbench.ai/leaderboard/terminal-bench/4.0');
  assert.equal(board.updatedAt, '2026-09-03T21:34:07.080Z');
  assert.equal(board.rows.length, 18);
  assert.deepEqual(board.rows[0], { rank: 1, model: 'GPT-6 Astra', modelUrl: 'https://developers.openai.com/api/docs/models/gpt-6-astra', agent: 'Codex', agentOrg: 'OpenAI', modelOrg: 'OpenAI', effort: 'max', accuracy: 58.18, ci95: 2.79, date: '2026-09-03', trials: 330, modelId: null });
});

test('terminal-bench parser rejects another leaderboard version, empty rows, incomplete rows, and pages without data', () => {
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ name: '2-1-0', rows: [tbRow()] })), /Unexpected Terminal-Bench leaderboard/);
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ rows: [] })), /no rows/);
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ rows: [tbRow({ metrics: { accuracy: null } })] })), /incomplete/);
  assert.throws(() => parseTerminalBench('<html></html>'), /unavailable/);
});

test('terminal-bench matching uses exact or suffix name matches inside the model organisation namespace and keeps the best row', () => {
  const models = [
    { id: 'anthropic/claude-opus-5', name: 'Anthropic: Claude Opus 5' }, { id: 'anthropic/claude-opus-5:batch', name: 'Anthropic: Claude Opus 5 (batch)' },
    { id: 'openai/gpt-6-astra', name: 'OpenAI: GPT-6 Astra' }, { id: 'other/opus-5', name: 'Other: Opus 5' },
  ];
  const board = parseTerminalBench(terminalBenchHtml({ rows: [
    tbRow({ rank: 1, metadata: tbMeta({ model_display: { label: 'Opus 5' }, model_org: { label: 'Anthropic' }, reasoning_effort: 'max' }), metrics: { accuracy: 51.8, accuracy_ci95_half_width: 3.4 } }),
    tbRow({ rank: 2, metadata: tbMeta({ model_display: { label: 'Opus 5' }, model_org: { label: 'Anthropic' }, reasoning_effort: 'high' }), metrics: { accuracy: 60, accuracy_ci95_half_width: 3 } }),
    tbRow({ rank: 3, metadata: tbMeta({ model_display: { label: 'GPT-6 Astra' }, model_org: { label: 'OpenAI' } }), metrics: { accuracy: 58.2 } }),
    tbRow({ rank: 4, metadata: tbMeta({ model_display: { label: 'Mystery' }, model_org: { label: 'Nobody' } }), metrics: { accuracy: 10 } }),
  ] }));
  const matched = matchTerminalBench(board, models);
  assert.deepEqual(matched.rows.map((row) => row.modelId), ['anthropic/claude-opus-5', 'anthropic/claude-opus-5', 'openai/gpt-6-astra', null]);
  assert.deepEqual(matched.byId.get('anthropic/claude-opus-5'), { accuracy: 60, ci95: 3, agent: 'Example Agent', effort: 'high', date: '2026-09-03' });
  assert.equal(matched.mapped, 3);
  assert.equal(matched.updatedAt, board.updatedAt);
});

test('terminal-bench matching falls back to aliases for ambiguous labels and ignores alias targets missing from the catalog', () => {
  const models = [{ id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash' }, { id: 'google/gemini-3.7-flash', name: 'Google: Gemini 3.7 Flash' }];
  const board = parseTerminalBench(terminalBenchHtml({ rows: [tbRow({ metadata: tbMeta({ model_display: { label: 'Flash' }, model_org: { label: 'Google' } }) })] }));
  assert.equal(matchTerminalBench(board, models).rows[0].modelId, null);
  assert.equal(matchTerminalBench(board, models, { Flash: 'google/gemini-3.8-flash' }).rows[0].modelId, 'google/gemini-3.8-flash');
  assert.equal(matchTerminalBench(board, models, { Flash: 'google/missing' }).rows[0].modelId, null);
});
