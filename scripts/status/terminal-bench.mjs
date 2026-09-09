import { isCanonicalId, numberOrNull } from './catalog.mjs';
import { findInRecords, flightRecords } from './flight.mjs';

export const TERMINAL_BENCH_URL = 'https://www.tbench.ai/leaderboard/terminal-bench/4.0';
const LEADERBOARD_NAME = '4-0-0';
const ORG_NAMESPACES = new Map(Object.entries({
  openai: 'openai', anthropic: 'anthropic', google: 'google', 'google deepmind': 'google', xai: 'x-ai', 'z.ai': 'z-ai', zhipu: 'z-ai',
  moonshot: 'moonshotai', 'moonshot ai': 'moonshotai', deepseek: 'deepseek', alibaba: 'qwen', qwen: 'qwen', meta: 'meta',
  minimax: 'minimax', mistral: 'mistralai', 'mistral ai': 'mistralai',
}));

export const nameKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const label = (display) => text(display?.label);
function link(display) {
  try {
    const url = new URL(display?.url);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseTerminalBench(html) {
  const found = findInRecords(flightRecords(html), (value) => value.leaderboard && typeof value.leaderboard === 'object' && Array.isArray(value.rows));
  if (!found) throw new Error('Terminal-Bench leaderboard data is unavailable.');
  const { leaderboard, rows } = found;
  if (typeof leaderboard.title !== 'string' || !leaderboard.title.startsWith('Terminal-Bench') || leaderboard.name !== LEADERBOARD_NAME) {
    throw new Error(`Unexpected Terminal-Bench leaderboard: ${leaderboard.title ?? 'untitled'} (${leaderboard.name ?? 'unnamed'}).`);
  }
  if (rows.length === 0) throw new Error('Terminal-Bench leaderboard has no rows.');
  const updatedAt = new Date(leaderboard.updated_at ?? NaN);
  if (Number.isNaN(updatedAt.getTime())) throw new Error('Terminal-Bench leaderboard has no update time.');
  const parsed = rows.map((row) => {
    const meta = row.metadata ?? {};
    const metrics = row.metrics ?? {};
    const accuracy = numberOrNull(metrics.accuracy);
    const model = label(meta.model_display);
    const agent = label(meta.agent_display);
    if (accuracy === null || accuracy > 100 || !model || !agent || !Number.isInteger(row.rank) || row.rank < 1 || typeof meta.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
      throw new Error('Terminal-Bench row is incomplete.');
    }
    return {
      rank: row.rank, model, modelUrl: link(meta.model_display), agent, agentOrg: label(meta.agent_org), modelOrg: label(meta.model_org),
      effort: text(meta.reasoning_effort), accuracy, ci95: numberOrNull(metrics.accuracy_ci95_half_width), date: meta.date, trials: numberOrNull(metrics.n_trials), modelId: null,
    };
  }).sort((a, b) => a.rank - b.rank || b.accuracy - a.accuracy || a.model.localeCompare(b.model));
  return { title: leaderboard.title, url: TERMINAL_BENCH_URL, updatedAt: updatedAt.toISOString(), rows: parsed };
}

export function matchTerminalBench(leaderboard, models, aliases = {}) {
  const canonical = models.filter((model) => isCanonicalId(model.id));
  const byId = new Map();
  const rows = leaderboard.rows.map((row) => {
    const namespace = ORG_NAMESPACES.get((row.modelOrg ?? '').toLowerCase()) ?? null;
    const key = nameKey(row.model);
    const pool = namespace ? canonical.filter((model) => model.id.split('/')[0] === namespace) : canonical;
    const hits = pool.filter((model) => {
      const candidate = nameKey(model.name.replace(/^[^:]+:\s*/, ''));
      return candidate === key || candidate.endsWith(key);
    });
    let modelId = hits.length === 1 ? hits[0].id : null;
    const alias = aliases[row.model];
    if (!modelId && typeof alias === 'string' && canonical.some((model) => model.id === alias)) modelId = alias;
    if (modelId) {
      const current = byId.get(modelId);
      if (!current || row.accuracy > current.accuracy) byId.set(modelId, { accuracy: row.accuracy, ci95: row.ci95, agent: row.agent, effort: row.effort, date: row.date });
    }
    return { ...row, modelId };
  });
  return { title: leaderboard.title, url: leaderboard.url, updatedAt: leaderboard.updatedAt, rows, byId, mapped: rows.filter((row) => row.modelId !== null).length };
}
