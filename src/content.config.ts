import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const SOURCE_KEYS = ['news', 'repo', 'paper', 'sns', 'release', 'tool', 'read'] as const;

/** 독자 신호 — action: 마감·패치 등 실제 행동 필요 / noise: 화제 대비 실질 영향 없음. 생략 시 맥락(context). */
export const SIGNAL_KEYS = ['action', 'noise'] as const;

const item = z.object({
  /** 전역 유일 ID — 클리핑/앵커에 사용. 관례: `i<이슈번호>-<슬러그>` */
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  url: z.string().url(),
  source: z.enum(SOURCE_KEYS),
  /** 출처 표기: GitHub, arXiv, X, 블로그명 등 */
  origin: z.string().nullish(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  /** 2–3문장 요약, 한국어 */
  summary: z.string(),
  /** 선별 이유 한 줄 (에디터 노트) */
  note: z.string().nullish(),
  signal: z.enum(SIGNAL_KEYS).nullish(),
});

const issues = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/issues' }),
  schema: z.object({
    number: z.number().int().nonnegative(),
    title: z.string(),
    /** 발행일 YYYY-MM-DD */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** 수집 기간 표기 (자유 형식) */
    period: z.string().optional(),
    /** 에디터의 말 — 이슈 머리글 */
    intro: z.string().optional(),
    items: z.array(item).min(1),
  }),
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 상태판 — 뉴스(흐름) 위에 얹는 현재 답(상태). 발행 루틴이 이슈와 함께 점검한다. */
const boards = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/boards' }),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string(),
    /** 이 보드가 답하는 질문 */
    question: z.string(),
    /** 마지막 점검일 — 변경이 없어도 점검했으면 갱신 */
    updated: dateStr,
    /** 보드 배치 순서 */
    order: z.number().int().default(0),
    rows: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          /** 영역 — 행의 질문 축 */
          area: z.string(),
          /** 현재 답 */
          pick: z.string(),
          /** stable: 안정 / changed: 최근 변경 / watch: 주시 */
          status: z.enum(['stable', 'changed', 'watch']),
          /** 이 답이 된 날 */
          since: dateStr,
          note: z.string().nullish(),
          url: z.string().url().nullish(),
        }),
      )
      .min(1),
    changelog: z
      .array(
        z.object({
          date: dateStr,
          text: z.string(),
          /** 근거가 실린 호수 */
          issue: z.number().int().nonnegative().nullish(),
        }),
      )
      .default([]),
  }),
});

export const collections = { issues, boards };
