import type { CollectionEntry } from 'astro:content';

/** base가 '/DADES'여도 '/DADES/'여도 안전하게 내부 경로를 만든다. */
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
export const href = (path: string) => base + (path.startsWith('/') ? path : `/${path}`);

export type Issue = CollectionEntry<'issues'>;
export type Item = Issue['data']['items'][number];

/** 섹션 순서와 이름표 — 매거진의 고정 지면 구성 */
export const SOURCE_META: Record<string, { ko: string; en: string }> = {
  news: { ko: '뉴스', en: 'News' },
  release: { ko: '릴리스', en: 'Releases' },
  repo: { ko: '레포', en: 'Repositories' },
  paper: { ko: '논문', en: 'Papers' },
  tool: { ko: '도구', en: 'Tools' },
  sns: { ko: '포스트', en: 'Posts' },
  read: { ko: '읽을거리', en: 'Readings' },
};
export const SOURCE_ORDER = Object.keys(SOURCE_META);

export const fmtDate = (iso: string) => iso.replaceAll('-', '.');

export const issueHref = (n: number) => href(`/issues/${n}/`);
export const tagHref = (tag: string) => href(`/archive/${tag}/`);
export const issueNo = (n: number) => `№ ${String(n).padStart(2, '0')}`;

export const sortIssues = (issues: Issue[]) =>
  [...issues].sort((a, b) => b.data.number - a.data.number);

export interface FlatItem {
  item: Item;
  issue: { number: number; title: string; date: string };
}

export const flattenItems = (issues: Issue[]): FlatItem[] =>
  sortIssues(issues).flatMap((issue) =>
    issue.data.items.map((item) => ({
      item,
      issue: { number: issue.data.number, title: issue.data.title, date: issue.data.date },
    })),
  );

export const collectTags = (issues: Issue[]) => {
  const counts = new Map<string, number>();
  for (const { item } of flattenItems(issues)) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};

/** 클립 버튼에 심는 스냅샷 — 스크랩북 페이지가 이것만으로 렌더링한다. */
export const clipPayload = (flat: FlatItem) => ({
  id: flat.item.id,
  title: flat.item.title,
  url: flat.item.url,
  source: flat.item.source,
  origin: flat.item.origin ?? null,
  tags: flat.item.tags,
  summary: flat.item.summary,
  note: flat.item.note ?? null,
  issue: flat.issue,
});
