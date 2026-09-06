import type { Item } from './mag';

const securityTags = new Set(['security', 'ai-security', 'prompt-injection', 'privacy', 'safety', 'alignment']);
const agentTags = new Set(['agents', 'browser-agents', 'mcp', 'harness', 'agent']);

export const storyTopic = (item: Item): 'security' | 'agents' | 'ai' => {
  if (item.tags.some((tag) => securityTags.has(tag))) return 'security';
  if (item.tags.some((tag) => agentTags.has(tag))) return 'agents';
  return 'ai';
};

export const readingMinutes = (items: readonly Item[]) => Math.max(1,
  Math.ceil(items.map((item) => `${item.title} ${item.summary} ${item.note ?? ''}`).join(' ').length / 500),
);
