// Pure ranking and labelling rules for the status board. No DOM, no zod; shared by Astro, the browser, and Node tests.
export const AXES = Object.freeze(['intelligence', 'coding', 'agentic']);
export const METRICS = Object.freeze(['intelligence', 'coding', 'agentic', 'terminalBench', 'speed', 'cost', 'tokens7d']);
export const ASCENDING = new Set(['cost']);
export const VALUE_FLOOR = 0.8;
export const TOP_STRENGTH = 3;

export const baseId = (id) => id.replace(/^~/, '').replace(/:.*$/, '');
export const isCanonicalId = (id) => !id.startsWith('~') && !id.includes(':');

export function metricValue(model, metric) {
  if (metric === 'terminalBench') return model.terminalBench?.accuracy ?? null;
  if (metric === 'cost') return model.inputPrice === null || model.outputPrice === null ? null : model.inputPrice + model.outputPrice;
  return model[metric] ?? null;
}

export function rankBy(models, metric) {
  return models.filter((model) => metricValue(model, metric) !== null).sort((a, b) => {
    const av = metricValue(a, metric);
    const bv = metricValue(b, metric);
    return (ASCENDING.has(metric) ? av - bv : bv - av) || a.name.localeCompare(b.name);
  });
}

export function canonicalModels(models) {
  const groups = new Map();
  for (const model of models) {
    const base = baseId(model.id);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(model);
  }
  return [...groups].map(([base, group]) => {
    const primary = group.find((model) => model.id === base) ?? [...group].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id))[0];
    const variants = group.filter((model) => model !== primary)
      .map((model) => ({ id: model.id, kind: model.id.includes(':') ? model.id.slice(model.id.indexOf(':') + 1) : 'alias', inputPrice: model.inputPrice, outputPrice: model.outputPrice }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
    return { ...primary, variants };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function variantChip(primary, variant) {
  if (variant.kind === 'batch' && primary.outputPrice && variant.outputPrice !== null && variant.outputPrice < primary.outputPrice) {
    return `batch −${Math.round((1 - variant.outputPrice / primary.outputPrice) * 100)}%`;
  }
  return variant.kind;
}

export function paretoFrontier(models) {
  const cost = (model) => metricValue(model, 'cost');
  const candidates = models.filter((model) => model.intelligence !== null && cost(model) !== null);
  return candidates
    .filter((model) => !candidates.some((other) => other !== model && ((other.intelligence > model.intelligence && cost(other) <= cost(model)) || (other.intelligence >= model.intelligence && cost(other) < cost(model)))))
    .sort((a, b) => cost(a) - cost(b) || b.intelligence - a.intelligence);
}

export function valueSet(models) {
  const leader = rankBy(models, 'intelligence')[0];
  if (!leader) return [];
  return paretoFrontier(models).filter((model) => model.id !== leader.id && model.intelligence >= leader.intelligence * VALUE_FLOOR);
}

export function valuePick(models) {
  return valueSet(models)[0] ?? null;
}

export function strengthMap(models) {
  const map = new Map();
  const add = (model, label) => map.set(model.id, [...(map.get(model.id) ?? []), label]);
  for (const [metric, label] of [['intelligence', '종합'], ['coding', '코딩'], ['agentic', '에이전트'], ['speed', '빠름']]) {
    for (const model of rankBy(models, metric).slice(0, TOP_STRENGTH)) add(model, label);
  }
  for (const model of valueSet(models)) add(model, '가성비');
  return map;
}

export function axisMaxima(models) {
  return Object.fromEntries(AXES.map((axis) => [axis, Math.max(0, ...models.map((model) => model[axis] ?? 0))]));
}

export function fingerprint(model, maxima) {
  return AXES.map((axis) => {
    const value = model[axis] ?? null;
    return { axis, value, ratio: value === null || !maxima[axis] ? null : value / maxima[axis] };
  });
}
