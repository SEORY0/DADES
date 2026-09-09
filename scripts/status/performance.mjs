import { isCanonicalId, numberOrNull } from './catalog.mjs';
import { findInRecords, flightRecords } from './flight.mjs';

export const EMPTY_PERFORMANCE = Object.freeze({ speed: null, latency: null, speedProvider: null, speedRequests: null, speedWindow: null });

export function performanceSample(models, limit = 32) {
  const eligible = models.filter((model) => isCanonicalId(model.id));
  const byMetric = (key) => eligible.filter((model) => model[key] !== null && model[key] !== undefined).sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id));
  const candidates = [...byMetric('intelligence').slice(0, 16), ...byMetric('tokens7d').slice(0, 16), ...byMetric('intelligence'), ...eligible];
  const seen = new Set();
  return candidates.filter((model) => !seen.has(model.id) && seen.add(model.id)).slice(0, limit);
}

export function parseModelPage(html, modelId) {
  const query = findInRecords(flightRecords(html), (value) => Array.isArray(value.queryKey) && value.queryKey[0] === 'model-page' && value.queryKey[1] === 'providerTableEndpointStats' && value.queryKey[2]?.variant === 'standard');
  if (!query) throw new Error(`Model page for ${modelId} has no endpoint statistics.`);
  const variant = query.queryKey[2]?.variant;
  if (variant !== 'standard') throw new Error(`Model page for ${modelId} reports the ${variant ?? 'unknown'} variant.`);
  const endpoints = query.state?.data;
  if (!Array.isArray(endpoints)) throw new Error(`Model page for ${modelId} has malformed endpoint statistics.`);
  if (endpoints.some((endpoint) => endpoint?.model_variant_slug !== modelId)) throw new Error(`Model page endpoints do not belong to ${modelId}.`);
  const candidates = endpoints.flatMap((endpoint) => {
    const stats = endpoint.stats;
    const speed = numberOrNull(stats?.p50_throughput);
    const requests = numberOrNull(stats?.throughput_request_count);
    const provider = typeof endpoint.provider_display_name === 'string' ? endpoint.provider_display_name.trim() : '';
    const slug = typeof endpoint.provider_slug === 'string' ? endpoint.provider_slug : '';
    if (endpoint.variant !== 'standard' || !provider || !slug || speed === null || speed <= 0 || requests === null || requests < 1) return [];
    if ([endpoint.is_free, endpoint.is_deranked, endpoint.is_disabled, endpoint.is_hidden, endpoint.is_byok_only].some(Boolean)) return [];
    const latency = numberOrNull(stats.p50_latency);
    return [{ speed, latency: latency === null ? null : latency / 1000, speedProvider: provider, speedRequests: requests, speedWindow: numberOrNull(stats.window_minutes), slug }];
  });
  candidates.sort((a, b) => b.speedRequests - a.speedRequests || b.speed - a.speed || a.slug.localeCompare(b.slug));
  if (!candidates[0]) return { ...EMPTY_PERFORMANCE };
  const { slug, ...chosen } = candidates[0];
  return chosen;
}
