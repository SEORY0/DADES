import { amount, compact, dollars, estimate, metricValue, metrics, modelName, type Metric, type Model } from './model-board';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
export function modelRow(model: Model, index: number, state: { metric: Metric; max: number; selected: ReadonlySet<string> }) {
  const row = element('tr');
  row.dataset.modelRow = model.id;
  row.append(element('td', String(index + 1), 'board-rank'));
  const heading = element('th');
  heading.scope = 'row';
  const identity = element('div', '', 'model-identity');
  const label = element('label', '', 'compare-check');
  const checkbox = element('input');
  checkbox.type = 'checkbox'; checkbox.dataset.compare = model.id; checkbox.checked = state.selected.has(model.id);
  checkbox.setAttribute('aria-label', `${modelName(model)} 비교`);
  label.append(checkbox);
  const name = element('div');
  const link = element('a', modelName(model));
  link.href = model.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.append(element('span', ' 원문, 새 탭', 'sr-only'));
  name.append(link, element('small', model.provider)); identity.append(label, name); heading.append(identity); row.append(heading);
  const values = [amount(model.intelligence), dollars(model.inputPrice), dollars(model.outputPrice), amount(model.speed), compact(model.tokens7d), compact(model.context)];
  const keys = ['intelligence', 'inputPrice', 'outputPrice', 'speed', 'tokens7d', 'context'];
  values.forEach((value, column) => {
    const active = keys[column] === state.metric;
    const cell = element('td', '', `numeric${active ? ' metric-active' : ''}`);
    cell.append(element('span', value));
    if (keys[column] === 'speed' && model.speedProvider) cell.append(element('small', model.speedProvider));
    if (active && !metrics[state.metric].ascending) {
      const bar = element('i', '', 'cell-bar');
      bar.style.setProperty('--bar', `${state.max ? (model[state.metric] ?? 0) / state.max * 100 : 0}%`); cell.append(bar);
    }
    row.append(cell);
  });
  return row;
}
export function comparisonCard(model: Model, budget: { input: number; output: number }) {
  const card = element('article', '', 'compare-model');
  const header = element('header');
  const remove = element('button', '×');
  remove.type = 'button'; remove.dataset.remove = model.id; remove.setAttribute('aria-label', `${modelName(model)} 비교에서 빼기`);
  header.append(element('h3', modelName(model)), remove);
  const list = element('dl');
  const values = [
    ['예상 토큰 비용', dollars(estimate(model, budget.input, budget.output))],
    ['성능 · AA 지수', amount(model.intelligence)], ['코딩 · AA 지수', amount(model.coding)],
    ['입력 / 100만 토큰', dollars(model.inputPrice)], ['출력 / 100만 토큰', dollars(model.outputPrice)],
    ['생성 속도 · tok/s', amount(model.speed)], ['첫 토큰 지연 · 초', amount(model.latency)], ['주간 사용량', compact(model.tokens7d)], ['컨텍스트 · tokens', compact(model.context)],
  ];
  for (const [label, value] of values) list.append(element('dt', label), element('dd', value, label === '예상 토큰 비용' ? 'estimated-cost' : ''));
  card.append(header, list);
  return card;
}
