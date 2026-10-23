import { findInRecords, flightRecords } from './flight.mjs';
import { numberOrNull } from './catalog.mjs';

export const AA_MODELS_URL = 'https://artificialanalysis.ai/leaderboards/models';
export const AA_CODING_URL = 'https://artificialanalysis.ai/agents/coding-agents';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const score = (value) => {
  const result = numberOrNull(value);
  return result !== null && result <= 100 ? result : null;
};
// AA and OpenRouter label some creators differently; both sides normalise to one key.
const PROVIDER_KEYS = new Map(Object.entries({ zai: 'z', spaceai: 'xai', spacexai: 'xai', kimi: 'moonshotai', alibaba: 'qwen', longcat: 'meituan' }));
const providerKey = (value) => {
  const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  return PROVIDER_KEYS.get(key) ?? key;
};
// Drop the "Provider: " catalog prefix and settings in parentheses; also try without a leading creator name.
const nameKeys = (value, provider) => {
  const key = String(value).replace(/^[^:]+:\s*/, '').replace(/\([^)]*\)/g, '').replace(/^Claude\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = String(provider ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return prefix && key.startsWith(prefix) && key.length > prefix.length ? [key, key.slice(prefix.length)] : [key];
};
const sameName = (model, row) => {
  const keys = new Set(nameKeys(model.name, model.provider));
  return nameKeys(row.name, row.provider).some((key) => keys.has(key));
};

function versionFrom(html, label) {
  const versions = [...new Set([...html.matchAll(new RegExp(`${label} v(\\d+\\.\\d+(?:\\.\\d+)?)`, 'g'))].map((match) => match[1]))];
  if (versions.length !== 1) throw new Error(`Missing or ambiguous ${label} version.`);
  return versions[0];
}

// Resolve only JSON data references in the public React payload; never execute scripts.
function resolve(value, records, depth = 0) {
  if (depth > 64) throw new Error('AA data reference is too deep.');
  if (typeof value === 'string') {
    const ref = /^\$([a-f\d]+)(?::(.+))?$/.exec(value);
    if (!ref) return value;
    let target = records.get(ref[1]);
    for (const part of ref[2]?.split(':') ?? []) target = part === 'props' && Array.isArray(target) ? target[3] : target?.[part];
    if (target === undefined) throw new Error('Unresolved AA data reference.');
    return resolve(target, records, depth + 1);
  }
  if (Array.isArray(value)) return value.map((item) => resolve(item, records, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, records, depth + 1)]));
  return value;
}

export function parseAAIntelligence(html) {
  const records = flightRecords(html);
  const props = findInRecords(records, (value) => Array.isArray(value.initialModels) && value.initialModels.some((model) => model && Object.hasOwn(model, 'intelligenceIndex')));
  if (!props?.initialModels.length) throw new Error('AA model leaderboard data is missing.');
  const version = versionFrom(html, 'Intelligence Index');
  const seen = new Set();
  const rows = props.initialModels.map((raw) => {
    const row = resolve(raw, records);
    if (!text(row.slug) || !text(row.name) || !text(row.modelCreatorName) || seen.has(row.slug)) throw new Error('AA model identity is missing or duplicated.');
    seen.add(row.slug);
    const measured = row.intelligenceIndexIsEstimated === false;
    const gdpval = numberOrNull(row.gdpvalNormalized);
    if (gdpval !== null && gdpval > 1) throw new Error('AA GDPval score is outside the published 0–1 scale.');
    return {
      id: row.slug, name: row.name, slug: row.slug, provider: row.modelCreatorName,
      openrouterId: null, version,
      intelligence: measured ? score(row.intelligenceIndex) : null,
      // AA stopped publishing its Agentic Index; the agent axis is GDPval-AA, an agentic knowledge-work benchmark on the same page.
      agentic: measured && gdpval !== null ? gdpval * 100 : null,
      costPerTask: numberOrNull(row.intelligenceIndexCostPerTask),
      url: `https://artificialanalysis.ai/models/${encodeURIComponent(row.slug)}`,
    };
  });
  if (!rows.some((row) => row.intelligence !== null)) throw new Error('AA has no measured intelligence scores.');
  return { version, rows };
}

export function parseAACoding(html) {
  const records = flightRecords(html);
  const props = findInRecords(records, (value) => Array.isArray(value.benchmarkRows));
  if (!props?.benchmarkRows.length) throw new Error('AA full coding leaderboard is missing.');
  const version = versionFrom(html, 'Coding Agent Index');
  const seen = new Set();
  const rows = props.benchmarkRows.map((raw) => resolve(raw, records)).flatMap((row) => {
    if (!text(row.id) || !text(row.display?.model) || !text(row.agentName) || seen.has(row.id)) throw new Error('AA coding identity is missing or duplicated.');
    seen.add(row.id);
    // Router rows combine several models, so they cannot stand for one catalog model.
    const creators = Array.isArray(row.modelCreators) ? row.modelCreators.map((creator) => text(creator?.name)) : [];
    if (row.isRouter !== false || creators.length !== 1 || !creators[0]) return [];
    const rawScore = numberOrNull(row.indexScore);
    if (rawScore !== null && rawScore > 1) throw new Error('AA coding score is outside the published 0–1 scale.');
    const complete = row.indexComponentCount === 3 && row.evalCount === 3 && Array.isArray(row.evals) && row.evals.length === 3;
    return [{
      id: row.id, name: row.display.model, provider: creators[0], agent: row.agentName,
      version, score: complete && row.isUnavailable === false && rawScore !== null ? rawScore * 100 : null,
      costPerTask: numberOrNull(row.mean?.costUsd), timePerTask: numberOrNull(row.mean?.agentWallTimeSec),
      url: AA_CODING_URL,
    }];
  });
  if (!rows.some((row) => row.score !== null)) throw new Error('AA has no complete coding evaluations.');
  return { version, rows };
}

export function matchAA(board, models, kind, aliases = {}) {
  const byId = new Map();
  const canonical = models.filter((model) => !model.id.includes(':') && !model.id.startsWith('~'));
  const identities = new Set(canonical.map((model) => model.id));
  const field = kind === 'intelligence' ? 'intelligence' : 'score';
  let mapped = 0;
  for (const row of board.rows) {
    if (row[field] === null) continue;
    const explicit = aliases[row.slug ?? row.id] ?? row.openrouterId;
    let id = identities.has(explicit) ? explicit : null;
    if (!id && !explicit) {
      const matches = canonical.filter((model) => sameName(model, row) && providerKey(model.provider) === providerKey(row.provider));
      if (matches.length === 1) id = matches[0].id;
    }
    if (!id) continue;
    mapped++;
    const prior = byId.get(id);
    // Keep the score and its cost/configuration together; never mix evaluation variants.
    if (!prior || row[field] > prior[field] || (row[field] === prior[field] && row.id.localeCompare(prior.id) < 0)) byId.set(id, row);
  }
  if (!byId.size) throw new Error('No AA evaluations map unambiguously to the catalog.');
  return { ...board, byId, mapped };
}
