import { z } from 'astro/zod';

const https = z.string().url().refine((url) => new URL(url).protocol === 'https:');
const number = z.number().finite().nonnegative().nullable();
export const boardSchema = z.object({
  schemaVersion: z.literal(1),
  fetchedAt: z.string().datetime(),
  sources: z.array(z.object({
    id: z.string(), label: z.string(), url: https,
    observedAt: z.string().datetime().nullable(), status: z.enum(['ok', 'unavailable']), note: z.string(),
  })),
  models: z.array(z.object({
    id: z.string(), name: z.string(), provider: z.string(), url: https,
    context: number, inputPrice: number, outputPrice: number,
    intelligence: number, coding: number, agentic: number,
    speed: number, latency: number, speedProvider: z.string().nullable(),
    tokens7d: number, previousTokens7d: number,
    dailyTokens: z.array(z.object({ date: z.string(), tokens: z.number().finite().nonnegative() })),
  })),
});
export type ModelBoard = z.infer<typeof boardSchema>;
export type Model = ModelBoard['models'][number];
export type Metric = 'intelligence' | 'outputPrice' | 'speed' | 'tokens7d';
export const metrics = {
  intelligence: { label: '성능', unit: 'AA 지수', title: '성능 1위', detail: 'Artificial Analysis · OpenRouter 제공', ascending: false },
  outputPrice: { label: '토큰 가격', unit: '$ / 1M', title: '최저 출력가', detail: 'USD / 출력 100만 토큰 · 조건별 과금 별도', ascending: true },
  speed: { label: '생성 속도', unit: 'tok/s', title: '속도 1위', detail: '최근 30분 · 관측된 제공 경로 기준', ascending: false },
  tokens7d: { label: '사용량', unit: 'tokens', title: '사용량 1위', detail: 'OpenRouter · 공개 주간 집계', ascending: false },
} as const;
export const metricKeys: readonly Metric[] = ['intelligence', 'outputPrice', 'speed', 'tokens7d'];
export const isMetric = (value: string | null): value is Metric => metricKeys.some((key) => key === value);
export const modelName = (model: Model) => model.name.replace(/^[^:]+:\s*/, '');
export const amount = (value: number | null, digits = 1) => value === null ? '미제공' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
export const dollars = (value: number | null) => value === null ? '미제공' : `$${amount(value, value > 0 && value < 0.1 ? 4 : 2)}`;
export const compact = (value: number | null) => value === null ? '미제공' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export function metricValue(model: Model, metric: Metric) {
  switch (metric) {
    case 'intelligence': return amount(model.intelligence);
    case 'outputPrice': return dollars(model.outputPrice);
    case 'speed': return amount(model.speed);
    case 'tokens7d': return compact(model.tokens7d);
  }
}
export function ranked(models: readonly Model[], metric: Metric) {
  return models.filter((model) => model[metric] !== null).sort((a, b) => {
    const av = a[metric] ?? 0;
    const bv = b[metric] ?? 0;
    return (metrics[metric].ascending ? av - bv : bv - av) || a.name.localeCompare(b.name);
  });
}
export function estimate(model: Model, input: number, output: number) {
  return model.inputPrice === null || model.outputPrice === null ? null : model.inputPrice * input + model.outputPrice * output;
}
export function tokenChange(model: Model) {
  return model.tokens7d === null || !model.previousTokens7d ? null : (model.tokens7d / model.previousTokens7d - 1) * 100;
}
export function observedAt(board: ModelBoard) {
  const date = new Date(board.fetchedAt);
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(date);
}
export function scatter(models: readonly Model[]) {
  const candidates = ranked(models, 'intelligence').filter((model) => estimate(model, 1, 1) !== null);
  const chosen = [...new Map([...candidates.slice(0, 14), ...[...candidates].sort((a, b) => (estimate(a, 1, 1) ?? 0) - (estimate(b, 1, 1) ?? 0)).slice(0, 6)].map((model) => [model.id, model])).values()];
  const maxCost = Math.max(10, ...chosen.map((model) => estimate(model, 1, 1) ?? 0));
  const maxScore = Math.max(20, Math.ceil(Math.max(...chosen.map((model) => model.intelligence ?? 0), 0) / 10) * 10);
  const x = (cost: number) => 55 + Math.log10(1 + cost) / Math.log10(1 + maxCost) * 550;
  const y = (score: number) => 260 - score / maxScore * 220;
  return { models: chosen, x, y, maxScore, ticks: [0, 1, 5, 10, 25, 50, 100, 250].filter((tick) => tick <= maxCost) };
}
export function providerTone(name: string) {
  const provider = name.toLowerCase();
  if (provider === 'openai') return 'blue';
  if (provider === 'anthropic') return 'orange';
  if (provider === 'google') return 'green';
  return 'slate';
}

export function sourceCopy(source: ModelBoard['sources'][number]) {
  const retained = source.status !== 'ok' && source.observedAt ? ' 이전 관측값을 유지하고 있습니다.' : '';
  switch (source.id) {
    case 'openrouter-catalog': return '텍스트 출력 모델의 기본 단가와 컨텍스트입니다. 별칭·무료·배치 경로가 포함되며, 제공 경로와 입력 길이에 따라 가격이 달라질 수 있습니다.' + retained;
    case 'artificial-analysis': return 'OpenRouter가 제공하는 AA 성능·코딩·에이전트 지수를 원래 단위로 표시합니다. 확인 시각은 벤치마크 실행일과 다릅니다.' + retained;
    case 'openrouter-performance': return '성능·사용량 상위 모델 중 최대 32개의 제공 경로를 확인합니다. 값이 있는 경로 하나의 최근 30분 출력 속도와 지연 중앙값(p50)입니다. 미제공은 0이 아닙니다.' + retained;
    case 'openrouter-usage': return '공개 주간 순위의 입력+출력 토큰 합계입니다. 집계 기간은 아래 UTC 기준일까지의 7일이며, 공개된 상위 모델만 포함합니다. 비공개·직접 API 사용량은 포함하지 않습니다.' + retained;
    default: return source.status === 'ok' ? '출처의 공개 관측값을 표시합니다.' : '현재 이 출처의 새 관측값을 확인하지 못했습니다.';
  }
}
export function sourceForMetric(board: ModelBoard, metric: Metric) {
  const sourceIds = { intelligence: 'artificial-analysis', outputPrice: 'openrouter-catalog', speed: 'openrouter-performance', tokens7d: 'openrouter-usage' };
  const source = board.sources.find((entry) => entry.id === sourceIds[metric]);
  if (!source?.observedAt) return '관측값 미제공';
  return (source.status === 'ok' ? '기준 ' : '이전 관측 ') + new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(source.observedAt)) + ' UTC';
}
