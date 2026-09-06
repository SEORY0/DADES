import type { ImageMetadata } from 'astro';
import { storyTopic } from './editorial';
import type { Issue } from './mag';

const images = import.meta.glob<ImageMetadata>('../assets/source-covers/*.{png,jpg,webp}', { eager: true, import: 'default' });

export function issueTopic(issue: Issue): 'ai' | 'agents' | 'security' {
  if (issue.data.cover?.topic) return issue.data.cover.topic;
  const counts = { ai: 0, agents: 0, security: 0 };
  issue.data.items.forEach((item) => { counts[storyTopic(item)] += 1; });
  if (counts.security > 0 && counts.security >= counts.ai && counts.security >= counts.agents) return 'security';
  if (counts.agents > counts.ai) return 'agents';
  return 'ai';
}

export function issueCover(issue: Issue): ImageMetadata | string | undefined {
  const image = issue.data.cover?.image;
  if (!image) return undefined;
  if (image.startsWith('https://')) return image;
  return images[`../assets/source-covers/${image}`];
}
