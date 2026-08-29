import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SOURCE_META, href, issueHref, issueNo, sortIssues } from '../lib/mag';

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function GET(context: APIContext) {
  const issues = sortIssues(await getCollection('issues'));

  return rss({
    title: 'DADES 매거진',
    description: '사람이 고르고 클로드가 엮는 AI 주간지 — Do Agents Dream of Electric Sheep?',
    site: new URL(href('/'), context.site).toString(),
    customData: '<language>ko</language>',
    items: issues.map((issue) => {
      const { number, title, date, intro, items } = issue.data;
      const list = items
        .map((item) => {
          const meta = [SOURCE_META[item.source]?.ko, item.origin].filter(Boolean).join(' · ');
          const note = item.note ? `<br/><em>노트 · ${esc(item.note)}</em>` : '';
          return `<li><a href="${esc(item.url)}">${esc(item.title)}</a> <small>${esc(meta)}</small><br/>${esc(item.summary)}${note}</li>`;
        })
        .join('');
      return {
        title: `${issueNo(number)} — ${title}`,
        link: issueHref(number),
        // KST 오전 발행 기준으로 고정
        pubDate: new Date(`${date}T09:00:00+09:00`),
        description: intro ?? `${items.length}개 항목`,
        content: `${intro ? `<p>${esc(intro)}</p>` : ''}<ul>${list}</ul>`,
      };
    }),
  });
}
