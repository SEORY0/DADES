import type { Model } from './model-board';

export type Axis = 'intelligence' | 'coding' | 'agentic';
export type Metric = Axis | 'terminalBench' | 'speed' | 'cost' | 'tokens7d';
export type Strength = '종합' | '코딩' | '에이전트' | '빠름' | '가성비';
export interface Variant { id: string; kind: string; inputPrice: number | null; outputPrice: number | null }
export type CanonicalModel = Model & { variants: Variant[] };
export interface FingerprintBar { axis: Axis; value: number | null; ratio: number | null }

export const AXES: readonly Axis[];
export const METRICS: readonly Metric[];
export const ASCENDING: ReadonlySet<Metric>;
export const VALUE_FLOOR: number;
export const TOP_STRENGTH: number;
export function baseId(id: string): string;
export function isCanonicalId(id: string): boolean;
export function metricValue(model: Model, metric: Metric): number | null;
export function rankBy<T extends Model>(models: readonly T[], metric: Metric): T[];
export function canonicalModels(models: readonly Model[]): CanonicalModel[];
export function variantChip(primary: Model, variant: Variant): string;
export function taskCost(model: Model, axis?: Axis): number | null;
export function paretoFrontier<T extends Model>(models: readonly T[], axis?: Axis): T[];
export function valueSet<T extends Model>(models: readonly T[]): T[];
export function valuePick<T extends Model>(models: readonly T[]): T | null;
export function strengthMap(models: readonly Model[]): Map<string, Strength[]>;
export function axisMaxima(models: readonly Model[]): Record<Axis, number>;
export function fingerprint(model: Model, maxima: Record<Axis, number>): FingerprintBar[];
