import { amount, compact, dollars, taskCost, metrics, modelName, providerTone, ranked, scatter, terminalRows, terminalUpdated, type Axis, type CanonicalModel, type Model, type ModelBoard } from './model-board';
import { element } from './model-board-render';

function svgNode(tag: string, attributes: Record<string, string | number>, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.textContent = text;
  return node;
}

export function updateCharts(root: HTMLElement, board: ModelBoard, models: readonly CanonicalModel[], axis: Axis) {
  const chart = scatter(models, axis);
  const readout = (model: Model) => `${modelName(model)} · ${metrics[chart.axis].label} ${amount(model[chart.axis])} · 작업당 ${dollars(taskCost(model, chart.axis))}`;
  const svg = root.querySelector<SVGElement>('.scatter-chart');
  if (svg) {
    const items: SVGElement[] = [];
    for (const part of [0, .25, .5, .75, 1]) {
      const score = chart.maxScore * part;
      items.push(svgNode('line', { x1: 55, x2: 605, y1: chart.y(score), y2: chart.y(score), class: 'chart-grid' }), svgNode('text', { x: 42, y: chart.y(score) + 4, 'text-anchor': 'end' }, amount(score, 0)));
    }
    for (const tick of chart.ticks) items.push(svgNode('text', { x: chart.x(tick), y: 285, 'text-anchor': 'middle' }, `$${tick}`));
    items.push(svgNode('text', { x: 55, y: 17, class: 'axis-title', 'data-axis-title': '' }, `${metrics[chart.axis].label} · AA 지수 ↑`), svgNode('text', { x: 605, y: 305, 'text-anchor': 'end' }, '$ / 작업 · 로그 눈금 →'));
    if (chart.frontierPoints) items.push(svgNode('polyline', { class: 'frontier-line', points: chart.frontierPoints, 'data-frontier': '' }));
    for (const model of chart.models) {
      const label = readout(model);
      const dot = svgNode('circle', { cx: chart.x(taskCost(model, chart.axis) ?? 0), cy: chart.y(model[chart.axis] ?? 0), r: 6, class: `chart-dot tone-${providerTone(model.provider)}`, tabindex: 0, role: 'img', 'aria-label': label });
      dot.append(svgNode('title', {}, label));
      items.push(dot);
    }
    const labelled = [chart.models[0], chart.frontier[0]].filter((model, index, list): model is Model => Boolean(model) && list.indexOf(model) === index);
    labelled.forEach((model, index) => {
      items.push(svgNode('text', { class: 'point-label', x: chart.x(taskCost(model, chart.axis) ?? 0) + (index === 0 ? -8 : 8), y: chart.y(model[chart.axis] ?? 0) - 12, 'text-anchor': index === 0 ? 'end' : 'start' }, modelName(model)));
    });
    svg.replaceChildren(...items);
    const readoutNode = root.querySelector('[data-chart-readout]');
    const leader = chart.models[0];
    if (readoutNode) readoutNode.textContent = leader ? readout(leader) : '관측값 대기';
    const hint = root.querySelector<HTMLElement>('[data-scatter-hint]');
    if (hint) hint.hidden = chart.models.length === 0;
  }
  const usage = ranked(board.models, 'tokens7d').slice(0, 5);
  root.querySelector('[data-usage-bars]')?.replaceChildren(...usage.map((model, index) => {
    const row = element('li');
    const heading = element('div');
    heading.append(element('span', String(index + 1), 'usage-rank'), element('span', modelName(model), 'usage-name'), element('strong', compact(model.tokens7d)));
    const track = element('div', '', 'usage-track');
    const fill = element('span'); fill.style.width = `${(model.tokens7d ?? 0) / (usage[0]?.tokens7d || 1) * 100}%`;
    track.append(fill); row.append(heading, track); return row;
  }));
  const usageEmpty = root.querySelector<HTMLElement>('[data-usage-empty]');
  if (usageEmpty) usageEmpty.hidden = usage.length > 0;
  const rows = terminalRows(board);
  const top = rows[0]?.accuracy || 1;
  root.querySelector('[data-terminal-rows]')?.replaceChildren(...rows.map((row) => {
    const item = element('li');
    const heading = element('div');
    heading.append(element('span', String(row.rank), 'usage-rank'), element('span', row.model, 'usage-name'), element('strong', `${amount(row.accuracy)}%`));
    const track = element('div', '', 'usage-track');
    const fill = element('span'); fill.style.width = `${row.accuracy / top * 100}%`;
    track.append(fill); item.append(heading, element('small', `${row.agent}${row.effort ? ` · ${row.effort}` : ''}`, 'terminal-agent'), track); return item;
  }));
  const terminalEmpty = root.querySelector<HTMLElement>('[data-terminal-empty]');
  if (terminalEmpty) terminalEmpty.hidden = rows.length > 0;
  const terminalLink = root.querySelector<HTMLAnchorElement>('[data-terminal-link]');
  if (terminalLink) {
    const updated = terminalUpdated(board);
    terminalLink.textContent = `리더보드 원문${updated ? ` · ${updated}` : ''} ↗`;
    if (board.terminalBench) terminalLink.href = board.terminalBench.url;
  }
}
