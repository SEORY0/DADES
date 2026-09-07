import type { Model } from './model-board';

const icons: Record<string, string> = {
  anthropic: 'Anthropic.svg',
  cohere: 'Cohere.png',
  tencent: 'Tencent.png',
  openai: 'OpenAI.svg',
  google: 'GoogleGemini.svg',
  deepseek: 'DeepSeek.png',
  'z-ai': 'ZAI.svg',
};

export function modelArtwork(model?: Pick<Model, 'id'>) {
  if (!model) return null;
  const namespace = model.id.split('/')[0];
  if (namespace === 'google' && !model.id.startsWith('google/gemini-')) return null;
  const file = Object.hasOwn(icons, namespace) ? icons[namespace] : null;
  return file ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/model-icons/${file}` : null;
}
