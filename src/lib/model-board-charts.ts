import { amount, compact, dollars, estimate, modelName, providerTone, ranked, scatter, type ModelBoard } from './model-board';
import { element } from './model-board-render';

function svgNode(tag: string, attributes: Record<string, string | number>, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.textContent = text;
  return node;
}
export function updateCharts(root: HTMLElement, board: ModelBoard) {
  const chart = scatter(board.models);
  const svg = root.querySelector<SVGElement>('.scatter-chart');
  if (svg) {
    const items: SVGElement[] = [];
    for (const part of [0, .25, .5, .75, 1]) {
      const score = chart.maxScore * part;
      items.push(svgNode('line', { x1: 55, x2: 605, y1: chart.y(score), y2: chart.y(score), class: 'chart-grid' }), svgNode('text', { x: 42, y: chart.y(score) + 4, 'text-anchor': 'end' }, amount(score, 0)));
    }
    for (const tick of chart.ticks) items.push(svgNode('text', { x: chart.x(tick), y: 285, 'text-anchor': 'middle' }, `$${tick}`));
    items.push(svgNode('text', { x: 55, y: 17 }, '성능 · AA 지수 ↑'), svgNode('text', { x: 605, y: 305, 'text-anchor': 'end' }, '비용 USD · 로그 눈금 →'));
    for (const model of chart.models) {
      const label = `${modelName(model)}: 성능 ${amount(model.intelligence)}, 비용 ${dollars(estimate(model, 1, 1))}`;
      const dot = svgNode('circle', { cx: chart.x(estimate(model, 1, 1) ?? 0), cy: chart.y(model.intelligence ?? 0), r: 6, class: `chart-dot tone-${providerTone(model.provider)}`, tabindex: 0, role: 'img', 'aria-label': label });
      dot.append(svgNode('title', {}, label)); items.push(dot);
    }
    const labelled = [chart.models[0], [...chart.models].filter((model) => (model.intelligence ?? 0) >= chart.maxScore / 2).sort((a, b) => (estimate(a, 1, 1) ?? 0) - (estimate(b, 1, 1) ?? 0))[0]];
    labelled.forEach((model, index) => { if (model) items.push(svgNode('text', { class: 'point-label', x: chart.x(estimate(model, 1, 1) ?? 0) + (index === 0 ? -8 : 8), y: chart.y(model.intelligence ?? 0) - 12, 'text-anchor': index === 0 ? 'end' : 'start' }, modelName(model))); });
    svg.replaceChildren(...items);
    const readout = root.querySelector('[data-chart-readout]');
    const leader = chart.models[0];
    if (readout) readout.textContent = leader ? `${modelName(leader)} · 성능 ${amount(leader.intelligence)} · 기준 비용 ${dollars(estimate(leader, 1, 1))}` : '관측값 대기';
    const hint = root.querySelector<HTMLElement>('[data-scatter-hint]');
    if (hint) hint.hidden = chart.models.length === 0;
  }
  const usage = ranked(board.models, 'tokens7d').slice(0, 5);
  const list = root.querySelector('[data-usage-bars]');
  list?.replaceChildren(...usage.map((model, index) => {
    const row = element('li');
    const heading = element('div');
    heading.append(element('span', String(index + 1), 'usage-rank'), element('span', modelName(model), 'usage-name'), element('strong', compact(model.tokens7d)));
    const track = element('div', '', 'usage-track');
    const fill = element('span'); fill.style.width = `${(model.tokens7d ?? 0) / (usage[0]?.tokens7d || 1) * 100}%`;
    track.append(fill); row.append(heading, track); return row;
  }));
  const empty = root.querySelector<HTMLElement>('[data-usage-empty]');
  if (empty) empty.hidden = usage.length > 0;
}
