import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const SOURCE_KEYS = ['news', 'repo', 'paper', 'sns', 'release', 'tool', 'read'] as const;

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

export const collections = { issues };
