import { z } from 'astro/zod';
import { ASCENDING, AXES, METRICS, rankBy, valueSet, metricValue as metricNumber, type Axis, type Metric } from './model-board-rules.mjs';

export type { Axis, CanonicalModel, Metric, Strength, Variant } from './model-board-rules.mjs';
export { axisMaxima, canonicalModels, fingerprint, metricValue as metricNumber, paretoFrontier, rankBy as ranked, strengthMap, valuePick, valueSet, variantChip } from './model-board-rules.mjs';

const https = z.string().url().refine((url) => new URL(url).protocol === 'https:');
const number = z.number().finite().nonnegative().nullable();
const percentage = z.number().min(0).max(100);
export const boardSchema = z.object({
  schemaVersion: z.literal(2),
  fetchedAt: z.string().datetime(),
  sources: z.array(z.object({
    id: z.string(), label: z.string(), url: https,
    observedAt: z.string().datetime().nullable(), status: z.enum(['ok', 'unavailable']), note: z.string(),
  })),
  terminalBench: z.object({
    title: z.string(), url: https, updatedAt: z.string().datetime(),
    rows: z.array(z.object({
      rank: z.number().int().positive(), model: z.string(), modelUrl: https.nullable(), agent: z.string(), agentOrg: z.string().nullable(), modelOrg: z.string().nullable(),
      effort: z.string().nullable(), accuracy: percentage, ci95: number, date: z.string(), trials: number, modelId: z.string().nullable(),
    })),
  }).nullable(),
  models: z.array(z.object({
    id: z.string(), name: z.string(), provider: z.string(), url: https,
    context: number, inputPrice: number, outputPrice: number,
    intelligence: number, coding: number, agentic: number,
    speed: number, latency: number, speedProvider: z.string().nullable(), speedRequests: number, speedWindow: number,
    terminalBench: z.object({ accuracy: percentage, ci95: number, agent: z.string(), effort: z.string().nullable(), date: z.string() }).nullable(),
    tokens7d: number, previousTokens7d: number,
    dailyTokens: z.array(z.object({ date: z.string(), tokens: z.number().finite().nonnegative() })),
  })),
});
export type ModelBoard = z.infer<typeof boardSchema>;
export type Model = ModelBoard['models'][number];
export type TerminalBenchRow = NonNullable<ModelBoard['terminalBench']>['rows'][number];

export const metrics: Record<Metric, { label: string; unit: string; title: string; ascending: boolean }> = {
  intelligence: { label: '종합', unit: 'AA', title: '종합 1위', ascending: ASCENDING.has('intelligence') },
  coding: { label: '코딩', unit: 'AA', title: '코딩 1위', ascending: ASCENDING.has('coding') },
  agentic: { label: '에이전트', unit: 'AA', title: '에이전트 1위', ascending: ASCENDING.has('agentic') },
  terminalBench: { label: 'TB 4.0', unit: '%', title: 'Terminal-Bench 1위', ascending: ASCENDING.has('terminalBench') },
  speed: { label: '속도', unit: 'tok/s', title: '속도 1위', ascending: ASCENDING.has('speed') },
  cost: { label: '비용', unit: '$ / 1M+1M', title: '가성비', ascending: ASCENDING.has('cost') },
  tokens7d: { label: '사용량', unit: 'tokens', title: '사용량 1위', ascending: ASCENDING.has('tokens7d') },
};
export const metricKeys: readonly Metric[] = METRICS;
export const axisKeys: readonly Axis[] = AXES;
export const cardMetrics = ['intelligence', 'coding', 'agentic', 'speed'] as const;
export const isMetric = (value: string | null): value is Metric => metricKeys.some((key) => key === value);
export const isAxis = (value: string | null): value is Axis => axisKeys.some((key) => key === value);
export const modelName = (model: Pick<Model, 'name'>) => model.name.replace(/^[^:]+:\s*/, '');
export const EMPTY = '–';
export const amount = (value: number | null, digits = 1) => value === null ? EMPTY : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
export const dollars = (value: number | null) => value === null ? EMPTY : `$${amount(value, value > 0 && value < 0.1 ? 4 : 2)}`;
export const compact = (value: number | null) => value === null ? EMPTY : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const percent = (value: number | null) => value === null ? EMPTY : `${amount(value, 1)}%`;
export function metricValue(model: Model, metric: Metric) {
  switch (metric) {
    case 'intelligence': case 'coding': case 'agentic': return amount(model[metric]);
    case 'terminalBench': return percent(metricNumber(model, metric));
    case 'speed': return amount(model.speed, 0);
    case 'cost': return dollars(metricNumber(model, metric));
    case 'tokens7d': return compact(model.tokens7d);
  }
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
export function scatter(models: readonly Model[], axis: Axis = 'intelligence') {
  const cost = (model: Model) => estimate(model, 1, 1) ?? 0;
  const candidates = rankBy(models, axis).filter((model) => estimate(model, 1, 1) !== null);
  const leader = candidates[0];
  const frontier = axis === 'intelligence' && leader ? [...valueSet(models).filter((model) => estimate(model, 1, 1) !== null), leader].sort((a, b) => cost(a) - cost(b)) : [];
  const chosen = [...new Map([...candidates.slice(0, 14), ...[...candidates].sort((a, b) => cost(a) - cost(b)).slice(0, 6), ...frontier].map((model) => [model.id, model])).values()];
  const maxCost = Math.max(10, ...chosen.map(cost));
  const maxScore = Math.max(20, Math.ceil(Math.max(...chosen.map((model) => model[axis] ?? 0), 0) / 10) * 10);
  const x = (value: number) => 55 + Math.log10(1 + value) / Math.log10(1 + maxCost) * 550;
  const y = (score: number) => 260 - score / maxScore * 220;
  const frontierPoints = frontier.flatMap((model, index) => {
    const px = x(cost(model));
    const py = y(model.intelligence ?? 0);
    const previous = frontier[index - 1];
    return previous ? [`${px},${y(previous.intelligence ?? 0)}`, `${px},${py}`] : [`${px},${py}`];
  }).join(' ');
  return { axis, models: chosen, x, y, maxScore, ticks: [0, 1, 5, 10, 25, 50, 100, 250].filter((tick) => tick <= maxCost), frontier, frontierPoints };
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
    case 'artificial-analysis': return 'OpenRouter가 전달하는 AA 종합·코딩·에이전트 지수를 원래 단위로 표시합니다. 확인 시각은 벤치마크 실행일과 다릅니다.' + retained;
    case 'terminal-bench': return 'tbench.ai 공식 4.0 리더보드의 에이전트+모델 조합 결과입니다. 모델 값은 조합 중 최고 정확도 하나이며 에이전트명을 함께 둡니다.' + retained;
    case 'openrouter-performance': return '종합·사용량 상위 최대 32개 모델의 OpenRouter 페이지에서 요청 수가 가장 많은 표준 경로의 최근 p50 속도·지연입니다. 미제공은 0이 아닙니다.' + retained;
    case 'openrouter-usage': return '공개 주간 순위의 입력+출력 토큰 합계입니다. 집계 기간은 아래 UTC 기준일까지의 7일이며, 공개된 상위 모델만 포함합니다. 비공개·직접 API 사용량은 포함하지 않습니다.' + retained;
    default: return source.status === 'ok' ? '출처의 공개 관측값을 표시합니다.' : '현재 이 출처의 새 관측값을 확인하지 못했습니다.';
  }
}
const metricSources: Record<Metric, string> = { intelligence: 'artificial-analysis', coding: 'artificial-analysis', agentic: 'artificial-analysis', terminalBench: 'terminal-bench', speed: 'openrouter-performance', cost: 'openrouter-catalog', tokens7d: 'openrouter-usage' };
export function sourceForMetric(board: ModelBoard, metric: Metric) {
  const source = board.sources.find((entry) => entry.id === metricSources[metric]);
  if (!source?.observedAt) return '관측값 미제공';
  return (source.status === 'ok' ? '기준 ' : '이전 관측 ') + new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(source.observedAt)) + ' UTC';
}
export function leaderNote(board: ModelBoard, leader: Model | undefined, metric: Metric) {
  const stamp = sourceForMetric(board, metric);
  if (!leader) return stamp;
  const detail = metric === 'coding' && leader.terminalBench ? `Terminal-Bench 4.0 · ${percent(leader.terminalBench.accuracy)}` : metric === 'speed' && leader.speedProvider ? leader.speedProvider : leader.provider;
  return `${detail} · ${stamp}`;
}
export function valueNote(models: readonly Model[], pick: Model) {
  const leader = rankBy(models, 'intelligence')[0];
  const share = leader?.intelligence && pick.intelligence !== null ? Math.round(pick.intelligence / leader.intelligence * 100) : null;
  return share === null ? `종합 ${amount(pick.intelligence)}` : `종합 ${amount(pick.intelligence)} · 선두의 ${share}%`;
}
export function terminalRows(board: ModelBoard, limit = 6): TerminalBenchRow[] {
  const seen = new Set<string>();
  return (board.terminalBench?.rows ?? []).filter((row) => !seen.has(row.model) && Boolean(seen.add(row.model))).slice(0, limit);
}
export function terminalUpdated(board: ModelBoard) {
  return board.terminalBench ? `${new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(board.terminalBench.updatedAt))} UTC 갱신` : null;
}
