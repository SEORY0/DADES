export const CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const PROVIDER_LABELS = new Map(Object.entries({
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'meta-llama': 'Meta', meta: 'Meta',
  deepseek: 'DeepSeek', qwen: 'Qwen', mistralai: 'Mistral', 'x-ai': 'xAI', 'z-ai': 'Z.AI',
  moonshotai: 'Moonshot AI', minimax: 'MiniMax', nvidia: 'NVIDIA', microsoft: 'Microsoft',
  cohere: 'Cohere', amazon: 'Amazon', alibaba: 'Alibaba', tencent: 'Tencent', baidu: 'Baidu',
  xiaomi: 'Xiaomi', 'bytedance-seed': 'ByteDance', bytedance: 'ByteDance', 'ibm-granite': 'IBM', openrouter: 'OpenRouter',
  perplexity: 'Perplexity', nousresearch: 'Nous Research', 'arcee-ai': 'Arcee AI',
  upstage: 'Upstage', poolside: 'Poolside', inception: 'Inception', stepfun: 'StepFun',
}));

export const isCanonicalId = (id) => !id.startsWith('~') && !id.includes(':');

export function numberOrNull(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseCatalog(payload) {
  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) throw new Error('Catalog contains no model records.');
  if (payload.links?.next || (typeof payload.total_count === 'number' && payload.total_count !== payload.data.length)) throw new Error('Catalog response is incomplete.');
  const seen = new Set();
  const models = payload.data.filter((row) => Array.isArray(row?.architecture?.output_modalities) && row.architecture.output_modalities.includes('text')).map((row) => {
    if (typeof row.id !== 'string' || !/^[~\w.-]+\/[\w.:+-]+$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim()) {
      throw new Error('Catalog contains a text model without a valid identity.');
    }
    if (seen.has(row.id)) throw new Error(`Catalog contains duplicate model ID: ${row.id}`);
    seen.add(row.id);
    const price = (value) => {
      const amount = numberOrNull(value);
      return amount === null ? null : numberOrNull(amount * 1_000_000);
    };
    const namespace = row.id.split('/')[0].replace(/^~/, '').toLowerCase();
    return {
      id: row.id,
      name: row.name.trim(),
      provider: PROVIDER_LABELS.get(namespace) ?? namespace,
      url: `https://openrouter.ai/${row.id}`,
      context: numberOrNull(row.context_length),
      inputPrice: price(row.pricing?.prompt),
      outputPrice: price(row.pricing?.completion),
      intelligence: null,
      coding: null,
      agentic: null,
      aaIntelligence: null,
      aaCoding: null,
      speed: null,
      latency: null,
      speedProvider: null,
      speedRequests: null,
      speedWindow: null,
      terminalBench: null,
      tokens7d: null,
      previousTokens7d: null,
      dailyTokens: [],
    };
  });
  if (models.length === 0) throw new Error('Catalog contains no text-output models.');
  return models.sort((a, b) => a.id.localeCompare(b.id));
}
