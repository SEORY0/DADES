import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAAIntelligence, parseAACoding, matchAA, AA_MODELS_URL, AA_CODING_URL } from '../scripts/status/artificial-analysis.mjs';
import { refreshSnapshot, upgradeSnapshot } from '../scripts/status/refresh.mjs';

const stream = (records, heading) => `<h1>${heading}</h1><script>self.__next_f.push(${JSON.stringify([1, records.map(([key, value]) => `${key}:${JSON.stringify(value)}\n`).join('')])})</script>`;
const model = (overrides = {}) => ({ name: 'Example Model (high)', slug: 'example-model-high', modelCreatorName: 'Example', intelligenceIndex: 50, intelligenceIndexIsEstimated: false, gdpvalNormalized: 0.6, intelligenceIndexCostPerTask: 1.2, ...overrides });
const intelligencePage = (rows = [model()], version = '4.3.2') => stream([['a', ['$', '$L1', null, { initialModels: rows }]]], `Intelligence Index v${version}`);
const coding = (overrides = {}) => ({ id: 'coding-one', display: { agent: 'Example CLI', model: 'Example Model (max)' }, agentName: 'Example CLI', modelCreators: [{ slug: 'example', name: 'Example' }], isRouter: false, indexScore: 0.7, mean: { costUsd: 2, agentWallTimeSec: 100 }, indexComponentCount: 3, evalCount: 3, evals: [{}, {}, {}], isUnavailable: false, ...overrides });
const codingPage = (rows = [coding()]) => stream([['a', { benchmarkRows: rows }]], 'Coding Agent Index v2.0');
const catalog = [{ id: 'example/model', name: 'Example: Model', provider: 'Example' }];

test('AAII preserves raw scores, version, configuration and measured task cost; estimates stay missing', () => {
  const result = parseAAIntelligence(intelligencePage([model(), model({ slug: 'estimated', intelligenceIndexIsEstimated: true })]));
  assert.equal(result.version, '4.3.2');
  assert.equal(result.rows[0].id, 'example-model-high');
  assert.equal(result.rows[0].intelligence, 50);
  assert.equal(result.rows[0].costPerTask, 1.2);
  assert.equal(result.rows[0].openrouterId, null);
  assert.deepEqual([result.rows[1].intelligence, result.rows[1].agentic], [null, null]);
  assert.throws(() => parseAAIntelligence(intelligencePage([model(), model()])), /duplicated/);
  assert.throws(() => parseAAIntelligence(intelligencePage([model({ slug: '' })])), /identity/);
  assert.throws(() => parseAAIntelligence(intelligencePage().replace('Intelligence Index v4.3.2', 'Missing version')), /version/);
  assert.throws(() => parseAAIntelligence(stream([['a', { models: [model()] }]], 'Intelligence Index v4.3.2')), /missing/);
});

test('the agent axis carries GDPval-AA on a 0–100 scale because AA no longer publishes an Agentic Index', () => {
  const [row] = parseAAIntelligence(intelligencePage()).rows;
  assert.equal(row.agentic, 60);
  assert.equal(parseAAIntelligence(intelligencePage([model({ gdpvalNormalized: null })])).rows[0].agentic, null);
  assert.throws(() => parseAAIntelligence(intelligencePage([model({ gdpvalNormalized: 61 })])), /0–1/);
});

test('coding parses the full table and resolves public data references rather than only highlight cards', () => {
  const html = stream([['a', ['$', '$Component', null, { rows: [coding()] }]], ['b', { benchmarkRows: ['$a:props:rows:0', coding({ id: 'second', indexScore: 0.6 })] }]], 'Coding Agent Index v2.0');
  const board = parseAACoding(html);
  assert.equal(board.rows.length, 2);
  assert.equal(board.rows[0].score, 70);
  assert.equal(board.rows[0].agent, 'Example CLI');
  assert.equal(board.rows[0].version, '2.0');
  assert.equal(board.rows[0].provider, 'Example');
  assert.equal(board.rows[0].costPerTask, 2);
  assert.throws(() => parseAACoding(codingPage(['$f:props:rows:0'])), /Unresolved/);
  assert.throws(() => parseAACoding(codingPage([coding({ indexScore: 70 })])), /0–1/);
  assert.throws(() => parseAACoding(codingPage([coding({ evalCount: 2 })])), /complete/);
  assert.throws(() => parseAACoding(codingPage([coding({ isUnavailable: true })])), /complete/);
  assert.throws(() => parseAACoding(codingPage([coding(), coding()])), /duplicated/);
});

test('coding leaves out router rows and evaluations that combine several model creators', () => {
  const router = coding({ id: 'router', isRouter: true, indexScore: 0.9 });
  const mixed = coding({ id: 'mixed', modelCreators: [{ name: 'Example' }, { name: 'Other' }], indexScore: 0.9 });
  const board = parseAACoding(codingPage([coding(), router, mixed]));
  assert.deepEqual(board.rows.map((row) => row.id), ['coding-one']);
  assert.throws(() => parseAACoding(codingPage([router])), /complete/);
});

test('matching keeps the highest measured configuration and its own cost without fuzzy or cross-provider matches', () => {
  const rows = parseAAIntelligence(intelligencePage([model(), model({ slug: 'higher', intelligenceIndex: 60, intelligenceIndexCostPerTask: 3 })]));
  const matched = matchAA(rows, [{ ...catalog[0], name: 'Example: Example Model' }], 'intelligence');
  assert.equal(matched.byId.get('example/model').id, 'higher');
  assert.equal(matched.byId.get('example/model').costPerTask, 3);
  assert.equal(matchAA(parseAACoding(codingPage()), [{ ...catalog[0], name: 'Example Model' }], 'coding').byId.size, 1);
  assert.throws(() => matchAA(parseAACoding(codingPage()), [{ ...catalog[0], name: 'Example Model', provider: 'Other' }], 'coding'), /unambiguously/);
  assert.throws(() => matchAA(parseAACoding(codingPage()), [{ ...catalog[0], name: 'Example Model Mini' }], 'coding'), /unambiguously/);
});

test('matching accepts AA creator labels and name prefixes that differ from OpenRouter, and slug aliases', () => {
  const models = [{ id: 'moonshotai/kimi-k3', name: 'MoonshotAI: Kimi K3', provider: 'Moonshot AI' }, { id: 'nvidia/nemotron-3-nano', name: 'NVIDIA: Nemotron 3 Nano', provider: 'NVIDIA' }, { id: 'nvidia/nemotron-3-ultra-550b', name: 'NVIDIA: Nemotron 3 Ultra', provider: 'NVIDIA' }];
  const board = parseAAIntelligence(intelligencePage([
    model({ slug: 'kimi-k3', name: 'Kimi K3 (Max)', modelCreatorName: 'Kimi' }),
    model({ slug: 'nemotron-nano', name: 'NVIDIA Nemotron 3 Nano (Reasoning)', modelCreatorName: 'NVIDIA' }),
    model({ slug: 'nemotron-ultra', name: 'Nemotron 3 Ultra 550B (Reasoning)', modelCreatorName: 'NVIDIA' }),
  ]));
  assert.deepEqual([...matchAA(board, models, 'intelligence').byId.keys()].sort(), ['moonshotai/kimi-k3', 'nvidia/nemotron-3-nano']);
  assert.equal(matchAA(board, models, 'intelligence', { 'nemotron-ultra': 'nvidia/nemotron-3-ultra-550b' }).byId.get('nvidia/nemotron-3-ultra-550b').id, 'nemotron-ultra');
});

test('v2 scores are never relabelled as direct AA observations during migration', () => {
  const old = { schemaVersion: 2, models: [{ id: 'example/model', intelligence: 90, coding: 99, agentic: 80, speed: 20 }], sources: [{ id: 'artificial-analysis' }] };
  const next = upgradeSnapshot(old);
  assert.deepEqual([next.models[0].intelligence, next.models[0].coding, next.models[0].agentic], [null, null, null]);
  assert.equal(next.models[0].speed, 20);
  assert.equal(next.sources.length, 0);
});

test('independent AA sources retain the last direct observations through outages without importing OR scores', async () => {
  const catalogRow = { id: 'example/model', name: 'Example Model', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.00001', completion: '0.00005' }, benchmarks: { artificial_analysis: { intelligence_index: 999, coding_index: 999 } } };
  const transport = async (url) => {
    if (url.includes('/api/v1/models')) return new Response(JSON.stringify({ data: [catalogRow] }));
    if (url === AA_MODELS_URL) return new Response(intelligencePage());
    if (url === AA_CODING_URL) return new Response(codingPage());
    return new Response('', { status: 503 });
  };
  const before = await refreshSnapshot({ transport, now: new Date('2026-09-08T00:00:00Z') });
  assert.equal(before.models[0].intelligence, 50);
  assert.equal(before.models[0].coding, 70);
  assert.equal(before.models[0].aaCoding.agent, 'Example CLI');
  const after = await refreshSnapshot({ previous: before, now: new Date('2026-09-09T00:00:00Z'), transport: async (url) => url === AA_CODING_URL ? new Response('', { status: 503 }) : transport(url) });
  assert.equal(after.models[0].coding, 70);
  assert.equal(after.sources.find((s) => s.id === 'aa-coding').observedAt, before.fetchedAt);
  assert.equal(after.sources.find((s) => s.id === 'aa-coding').status, 'unavailable');
  assert.equal(after.sources.find((s) => s.id === 'aa-intelligence').observedAt, after.fetchedAt);
});
