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
  const file = model.id.startsWith('meta/muse-spark') ? 'MetaAI.svg'
    : namespace === 'google' && !model.id.startsWith('google/gemini-')
    ? 'Model.svg' : Object.hasOwn(icons, namespace) ? icons[namespace] : 'Model.svg';
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/model-icons/${file}`;
}
