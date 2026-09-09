import { findSourceCover } from './cover.mjs';

export async function enrichStoryImages(issue) {
  const items = [];
  for (const item of issue.items) {
    if (item.image) { items.push(item); continue; }
    let result = await findSourceCover({ issue: { items: [item] } });
    if (result.cover && /\.(ico)(?:\?|$)/i.test(result.cover.image)) result.cover = null;
    if (!result.cover) {
      const homepage = new URL(item.url).origin + '/';
      result = await findSourceCover({ issue: { items: [{ ...item, url: homepage }] } });
    }
    if (result.cover && /\.(ico)(?:\?|$)/i.test(result.cover.image)) result.cover = null;
    items.push(result.cover ? { ...item, image: { url: result.cover.image, sourceUrl: result.cover.sourceUrl, credit: result.cover.credit } } : item);
  }
  return { ...issue, items };
}
