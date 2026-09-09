import { amount, compact, dollars, EMPTY, estimate, evaluationNote, fingerprint, isAxis, metricValue, metrics, modelName, percent, taskCost, variantChip, type Axis, type CanonicalModel, type Metric, type Model, type Strength } from './model-board';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function fingerprintNode(model: Model, maxima: Record<Axis, number>, metric: Metric) {
  const bars = fingerprint(model, maxima);
  const summary = bars.map((bar) => `${metrics[bar.axis].label} ${amount(bar.value)} (${evaluationNote(model, bar.axis)})`).join(' · ');
  const node = element('span', '', 'fingerprint');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', summary);
  node.title = summary;
  for (const bar of bars) {
    const item = element('span', '', `fp-axis${bar.axis === metric ? ' fp-active' : ''}${bar.ratio === null ? ' fp-missing' : ''}`);
    item.dataset.axis = bar.axis;
    item.setAttribute('aria-hidden', 'true');
    item.style.setProperty('--fp', `${Math.round((bar.ratio ?? 0) * 100)}%`);
    const track = element('span', '', 'fp-track');
    track.append(element('i', '', 'fp-bar'));
    item.append(element('span', amount(bar.value), 'fp-number'), track);
    node.append(item);
  }
  return node;
}

function numericCell(text: string, active: boolean, extra = '') {
  const cell = element('td', '', `numeric${extra ? ` ${extra}` : ''}${active ? ' metric-active' : ''}${text === EMPTY ? ' empty' : ''}`);
  cell.append(element('span', text));
  return cell;
}

export function modelRow(model: CanonicalModel, index: number, state: { metric: Metric; maxima: Record<Axis, number>; strengths: readonly Strength[]; selected: ReadonlySet<string> }) {
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
  label.append(checkbox, element('span', '비교', 'sr-only'));
  const name = element('div');
  const link = element('a', modelName(model));
  link.href = model.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.append(element('span', ' 원문, 새 탭', 'sr-only'));
  const provider = element('small', model.provider);
  for (const variant of model.variants) provider.append(element('span', variantChip(model, variant), 'variant-chip'));
  name.append(link, provider); identity.append(label, name); heading.append(identity); row.append(heading);
  const fingerprintCell = element('td', '', 'fingerprint-cell');
  fingerprintCell.append(fingerprintNode(model, state.maxima, state.metric));
  const strengthCell = element('td', '', 'strength-cell');
  for (const strength of state.strengths) strengthCell.append(element('span', strength, 'strength-pill'));
  const tb = model.terminalBench;
  const terminal = numericCell(metricValue(model, 'terminalBench'), state.metric === 'terminalBench');
  if (tb) terminal.title = `±${amount(tb.ci95)} · ${tb.agent}${tb.effort ? ` · ${tb.effort}` : ''} · ${tb.date}`;
  const speed = numericCell(metricValue(model, 'speed'), state.metric === 'speed');
  if (model.speedProvider) speed.append(element('small', model.speedProvider));
  const cost = numericCell(metricValue(model, 'cost'), state.metric === 'cost');
  cost.title = `입력 ${dollars(model.inputPrice)} · 출력 ${dollars(model.outputPrice)}`;
  const axisCell = numericCell(isAxis(state.metric) ? metricValue(model, state.metric) : '', isAxis(state.metric), 'axis-value');
  row.append(fingerprintCell, strengthCell, terminal, speed, cost, numericCell(metricValue(model, 'tokens7d'), state.metric === 'tokens7d'), axisCell);
  return row;
}

export function comparisonCard(model: Model, budget: { input: number; output: number }) {
  const card = element('article', '', 'compare-model');
  const header = element('header');
  const remove = element('button', '×');
  remove.type = 'button'; remove.dataset.remove = model.id; remove.setAttribute('aria-label', `${modelName(model)} 비교에서 빼기`);
  header.append(element('h3', modelName(model)), remove);
  const list = element('dl');
  const tb = model.terminalBench;
  const values: [string, string][] = [
    ['예상 토큰 비용', dollars(estimate(model, budget.input, budget.output))],
    ['종합 · AAII', amount(model.intelligence)], ['코딩 · AA CAI', amount(model.coding)], ['에이전트 · AA', amount(model.agentic)],
    ['종합 평가 설정', evaluationNote(model, 'intelligence')], ['코딩 평가 설정', evaluationNote(model, 'coding')],
    ['AAII 작업당 비용', dollars(taskCost(model))], ['코딩 작업당 비용', dollars(taskCost(model, 'coding'))],
    ['Terminal-Bench 4.0', tb ? `${percent(tb.accuracy)} · ${tb.agent}` : EMPTY],
    ['입력 / 100만 토큰', dollars(model.inputPrice)], ['출력 / 100만 토큰', dollars(model.outputPrice)],
    ['생성 속도 · tok/s', model.speedProvider ? `${amount(model.speed, 0)} · ${model.speedProvider}` : amount(model.speed, 0)],
    ['첫 토큰 지연 · 초', amount(model.latency)], ['속도 관측 요청 수', compact(model.speedRequests)],
    ['주간 사용량', compact(model.tokens7d)], ['컨텍스트 · tokens', compact(model.context)],
  ];
  for (const [label, value] of values) list.append(element('dt', label), element('dd', value, label === '예상 토큰 비용' ? 'estimated-cost' : ''));
  card.append(header, list);
  return card;
}
