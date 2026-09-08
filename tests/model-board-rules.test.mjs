import test from 'node:test';
import assert from 'node:assert/strict';
import { axisMaxima, canonicalModels, fingerprint, metricValue, paretoFrontier, rankBy, strengthMap, valuePick, valueSet, variantChip } from '../src/lib/model-board-rules.mjs';

const model = (id, overrides = {}) => ({
  id, name: id.split('/')[1], provider: id.split('/')[0], url: `https://openrouter.ai/${id}`, context: 1000, inputPrice: 1, outputPrice: 4,
  intelligence: null, coding: null, agentic: null, speed: null, latency: null, speedProvider: null, speedRequests: null, speedWindow: null,
  terminalBench: null, tokens7d: null, previousTokens7d: null, dailyTokens: [], ...overrides,
});

const fleet = [
  model('a/leader', { intelligence: 50, coding: 80, agentic: 55, inputPrice: 10, outputPrice: 50, speed: 60, terminalBench: { accuracy: 58, ci95: 3, agent: 'Codex', effort: 'max', date: '2026-09-03' } }),
  model('b/runner', { intelligence: 45, coding: 70, agentic: 50, inputPrice: 2, outputPrice: 8, speed: 90 }),
  model('c/cheap', { intelligence: 41, coding: 60, agentic: 40, inputPrice: 0.1, outputPrice: 0.3, speed: 120 }),
  model('d/dominated', { intelligence: 44, coding: 65, agentic: 45, inputPrice: 3, outputPrice: 9, speed: 30 }),
  model('e/weak', { intelligence: 20, coding: 30, agentic: 10, inputPrice: 0, outputPrice: 0, speed: 200 }),
  model('f/blank', { inputPrice: null, outputPrice: null }),
];

test('metric values read nested Terminal-Bench accuracy and derived 1M+1M cost, leaving unknowns null', () => {
  assert.equal(metricValue(fleet[0], 'terminalBench'), 58);
  assert.equal(metricValue(fleet[1], 'terminalBench'), null);
  assert.equal(metricValue(fleet[0], 'cost'), 60);
  assert.equal(metricValue(model('x/y', { inputPrice: null }), 'cost'), null);
  assert.equal(metricValue(fleet[5], 'intelligence'), null);
});

test('ranking sorts cost ascending, everything else descending, and drops models without a value', () => {
  assert.deepEqual(rankBy(fleet, 'cost').map((m) => m.id), ['e/weak', 'c/cheap', 'b/runner', 'd/dominated', 'a/leader']);
  assert.deepEqual(rankBy(fleet, 'speed').slice(0, 2).map((m) => m.id), ['e/weak', 'c/cheap']);
  assert.deepEqual(rankBy(fleet, 'terminalBench').map((m) => m.id), ['a/leader']);
  assert.deepEqual(rankBy(fleet, 'tokens7d'), []);
});

test('canonical folding keeps the base model as the row and lists alias, batch, and free variants as chips', () => {
  const folded = canonicalModels([model('x/base', { outputPrice: 10 }), model('x/base:batch', { outputPrice: 5 }), model('x/base:free', { inputPrice: 0, outputPrice: 0 }), model('~x/base'), model('y/only:free', { outputPrice: 0 })]);
  assert.deepEqual(folded.map((m) => m.id), ['x/base']);
  assert.equal(folded.length, 1);
  assert.deepEqual(folded[0].variants.map((v) => v.kind), ['alias', 'batch', 'free']);
  assert.deepEqual(folded[0].variants.map((v) => variantChip(folded[0], v)), ['alias', 'batch −50%', 'free']);
});

test('the Pareto frontier keeps models nothing beats on both score and cost, and value picks the cheapest strong one', () => {
  assert.deepEqual(paretoFrontier(fleet).map((m) => m.id), ['e/weak', 'c/cheap', 'b/runner', 'a/leader']);
  assert.deepEqual(valueSet(fleet).map((m) => m.id), ['c/cheap', 'b/runner']);
  assert.equal(valuePick(fleet).id, 'c/cheap');
  assert.equal(valuePick([model('z/none')]), null);
});

test('strength labels mark the top three per axis, the top three fastest, and the value set in a fixed order', () => {
  const labels = strengthMap(fleet);
  assert.deepEqual(labels.get('a/leader'), ['종합', '코딩', '에이전트']);
  assert.deepEqual(labels.get('b/runner'), ['종합', '코딩', '에이전트', '빠름', '가성비']);
  assert.deepEqual(labels.get('c/cheap'), ['빠름', '가성비']);
  assert.deepEqual(labels.get('e/weak'), ['빠름']);
  assert.equal(labels.get('f/blank'), undefined);
});

test('fingerprints scale each axis to the fleet maximum and mark missing axes instead of drawing zero', () => {
  const maxima = axisMaxima(fleet);
  assert.deepEqual(maxima, { intelligence: 50, coding: 80, agentic: 55 });
  assert.deepEqual(fingerprint(fleet[1], maxima).map((bar) => bar.ratio), [0.9, 0.875, 50 / 55]);
  assert.deepEqual(fingerprint(fleet[5], maxima).map((bar) => bar.ratio), [null, null, null]);
  assert.deepEqual(fingerprint(fleet[5], maxima).map((bar) => bar.axis), ['intelligence', 'coding', 'agentic']);
});
