import { boardSchema, isMetric, metricKeys, metrics, metricValue, modelName, observedAt, ranked, sourceCopy, sourceForMetric, type Metric } from './model-board';
import { comparisonCard, element, modelRow } from './model-board-render';
import { updateCharts } from './model-board-charts';
import { modelArtwork } from './model-artwork';

function mount(root: HTMLElement) {
  const payload = document.getElementById('model-board-data');
  if (!payload?.textContent) return;
  const initial = boardSchema.safeParse(JSON.parse(payload.textContent));
  if (!initial.success) return;
  let board = initial.data;
  let metric: Metric = 'intelligence';
  let limit = 20;
  const selected = new Set<string>();
  const budget = { input: 1, output: 1 };
  const query = root.querySelector<HTMLInputElement>('[data-model-query]');
  const provider = root.querySelector<HTMLSelectElement>('[data-model-provider]');
  const rows = root.querySelector<HTMLTableSectionElement>('[data-model-rows]');
  const feedback = root.querySelector<HTMLElement>('[data-board-feedback]');
  const empty = root.querySelector<HTMLElement>('[data-ranking-empty]');
  const more = root.querySelector<HTMLButtonElement>('[data-more]');
  const refresh = root.querySelector<HTMLButtonElement>('[data-refresh]');
  if (!query || !provider || !rows || !feedback || !empty || !more || !refresh) return;
  root.classList.add('has-board-js');
  root.querySelectorAll<HTMLElement>('[data-js-only]').forEach((node) => { node.hidden = false; });
  const saveURL = () => {
    const url = new URL(location.href);
    for (const [key, value] of [['metric', metric === 'intelligence' ? '' : metric], ['q', query.value.trim()], ['provider', provider.value === 'all' ? '' : provider.value]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }
  const renderComparison = () => {
    const models = board.models.filter((model) => selected.has(model.id));
    root.querySelector('[data-comparison]')?.replaceChildren(...models.map((model) => comparisonCard(model, budget)));
    const count = root.querySelector('[data-selection-count]');
    if (count) count.textContent = `${selected.size} / 3`;
    const dock = root.querySelector<HTMLElement>('[data-compare-dock]');
    if (dock) dock.hidden = selected.size === 0;
    const dockCount = root.querySelector('[data-dock-count]');
    if (dockCount) dockCount.textContent = `${selected.size} / 3`;
    root.querySelectorAll<HTMLInputElement>('[data-compare]').forEach((checkbox) => { checkbox.checked = selected.has(checkbox.dataset.compare ?? ''); });
  }
  const render = () => {
    const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = board.models.filter((model) => (provider.value === 'all' || model.provider === provider.value) && terms.every((term) => `${model.name} ${model.provider}`.toLowerCase().includes(term)));
    const sorted = ranked(filtered, metric);
    rows.replaceChildren(...sorted.slice(0, limit).map((model, index) => modelRow(model, index, { metric, max: sorted[0]?.[metric] ?? 1, selected })));
    more.hidden = sorted.length <= limit;
    empty.hidden = sorted.length > 0;
    const heading = empty.querySelector('h3'); const text = empty.querySelector('p');
    if (heading) heading.textContent = filtered.length && sorted.length === 0 ? '이 지표는 아직 관측값이 없습니다' : '일치하는 모델이 없습니다';
    if (text) text.textContent = filtered.length && sorted.length === 0 ? '출처가 값을 제공하면 자동으로 순위에 반영합니다. 다른 지표를 살펴보세요.' : '검색어 또는 개발사를 바꿔 보세요.';
    const count = root.querySelector('[data-ranking-count]');
    if (count) count.textContent = `${metrics[metric].label} · ${sorted.length}개 · ${metrics[metric].ascending ? '낮은' : '높은'} 순`;
    root.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
    root.querySelectorAll<HTMLElement>('[data-column]').forEach((column) => { if (column.dataset.column === metric) column.setAttribute('aria-sort', metrics[metric].ascending ? 'ascending' : 'descending'); else column.removeAttribute('aria-sort'); });
  }
  const freshness = () => {
    const source = board.sources.find((entry) => entry.id === 'openrouter-catalog');
    const age = source?.status === 'ok' && source.observedAt ? Date.now() - new Date(source.observedAt).getTime() : Infinity;
    const state = root.querySelector<HTMLElement>('[data-freshness]');
    if (state) { state.textContent = age > 2 * 60 * 60 * 1000 ? '갱신 지연' : '관측값'; state.dataset.stale = String(age > 2 * 60 * 60 * 1000); }
  }
  const restore = () => {
    const params = new URLSearchParams(location.search);
    const value = params.get('metric'); metric = isMetric(value) ? value : 'intelligence';
    query.value = (params.get('q') ?? '').slice(0, 100);
    const author = params.get('provider') ?? 'all';
    provider.value = [...provider.options].some((option) => option.value === author) ? author : 'all';
    limit = 20; render(); saveURL();
  }
  for (const button of root.querySelectorAll<HTMLElement>('[data-metric],[data-metric-shortcut]')) button.addEventListener('click', () => {
    const value = button.dataset.metric ?? button.dataset.metricShortcut ?? null;
    if (isMetric(value)) { metric = value; limit = 20; render(); saveURL(); }
  });
  query.addEventListener('input', () => { limit = 20; render(); saveURL(); });
  provider.addEventListener('change', () => { limit = 20; render(); saveURL(); });
  root.querySelector('[data-reset]')?.addEventListener('click', () => { query.value = ''; provider.value = 'all'; metric = 'intelligence'; limit = 20; render(); saveURL(); query.focus(); });
  more.addEventListener('click', () => { limit += 20; render(); });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.compare) return;
    const id = target.dataset.compare;
    if (target.checked && selected.size >= 3) { target.checked = false; feedback.textContent = '비교는 최대 3개까지 가능합니다. 선택한 모델을 하나 빼고 다시 골라 주세요.'; return; }
    if (target.checked) selected.add(id); else selected.delete(id);
    feedback.textContent = `${selected.size}개 모델을 비교 목록에 담았습니다.`; renderComparison();
  });
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-remove]');
    if (!button?.dataset.remove) return;
    selected.delete(button.dataset.remove); renderComparison();
    root.querySelector<HTMLInputElement>('[data-compare]')?.focus();
  });
  root.querySelectorAll<HTMLInputElement>('[data-budget]').forEach((input) => input.addEventListener('input', () => {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || value < 0 || value > 100) { input.setCustomValidity('0에서 100 사이의 값을 입력하세요.'); input.reportValidity(); return; }
    input.setCustomValidity('');
    if (input.dataset.budget === 'input') budget.input = value; else budget.output = value;
    renderComparison();
  }));
  for (const eventName of ['focusin', 'pointerover', 'click']) root.querySelector('[data-scatter]')?.addEventListener(eventName, (event) => {
    if (!(event.target instanceof Element)) return;
    const label = event.target.closest('.chart-dot')?.getAttribute('aria-label');
    const readout = root.querySelector('[data-chart-readout]');
    if (label && readout) readout.textContent = label;
  });
  let pending = false;
  const refreshBoard = async (manual: boolean) => {
    if (pending || (!manual && document.hidden)) return;
    const restoreRefreshFocus = manual && document.activeElement === refresh;
    pending = true; refresh.disabled = true;
    try {
      const url = new URL(root.dataset.feed ?? '', location.origin); url.searchParams.set('v', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = boardSchema.parse(await response.json());
      const changed = next.fetchedAt > board.fetchedAt;
      if (changed && !manual && document.activeElement?.closest('[data-model-rows],[data-scatter],[data-comparison],[data-board-sources]')) {
        feedback.textContent = '새 관측값이 있습니다. 새로 확인을 누르면 적용합니다.';
        return;
      }
      if (changed) {
        const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement.dataset.compare : undefined;
        board = next;
        const author = provider.value;
        provider.replaceChildren(...['all', ...new Set(board.models.map((model) => model.provider))].sort().map((name) => { const option = element('option', name === 'all' ? '모든 개발사' : name); option.value = name; return option; }));
        provider.value = [...provider.options].some((option) => option.value === author) ? author : 'all';
        for (const id of selected) if (!board.models.some((model) => model.id === id)) selected.delete(id);
        for (const key of metricKeys) {
          const leader = ranked(board.models, key)[0];
          const card = root.querySelector<HTMLElement>(`[data-metric-shortcut="${key}"]`);
          if (card) { if (leader) card.dataset.leaderModel = leader.id; else delete card.dataset.leaderModel; }
          const image = root.querySelector<HTMLImageElement>(`[data-leader-art="${key}"]`);
          if (image) {
            const artwork = modelArtwork(leader);
            image.hidden = !artwork;
            if (artwork) image.src = artwork; else image.removeAttribute('src');
          }
          const value = root.querySelector(`[data-leader-value="${key}"]`); const name = root.querySelector(`[data-leader-name="${key}"]`);
          const date = root.querySelector(`[data-metric-date="${key}"]`); if (date) date.textContent = sourceForMetric(board, key);
          if (value) value.textContent = leader ? metricValue(leader, key) : '—'; if (name) name.textContent = leader ? modelName(leader) : '관측 데이터 대기';
        }
        const time = root.querySelector<HTMLTimeElement>('[data-board-time]'); if (time) { time.dateTime = board.fetchedAt; time.textContent = observedAt(board); }
        root.querySelector('[data-board-sources]')?.replaceChildren(...board.sources.map((source) => {
          const row = element('li'); const link = element('a', `${source.label} ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          row.append(link, element('span', `${source.status === 'ok' ? '확인' : '미제공'} · ${source.observedAt ?? '관측 시각 없음'}`), element('p', sourceCopy(source))); return row;
        }));
        render(); renderComparison(); updateCharts(root, board);
        if (focused) [...root.querySelectorAll<HTMLInputElement>('[data-compare]')].find((input) => input.dataset.compare === focused)?.focus({ preventScroll: true });
      }
      if (manual || changed) feedback.textContent = changed ? '새 관측값으로 업데이트했습니다.' : '새로 확인했습니다. 현재 표시된 관측값이 최신 파일입니다.';
    } catch (error) {
      feedback.textContent = error instanceof Error ? '새 데이터를 확인하지 못했습니다. 마지막 관측값을 유지합니다.' : '데이터 확인 중 오류가 발생했습니다. 마지막 관측값을 유지합니다.';
    } finally {
      pending = false; refresh.disabled = false; freshness();
      if (restoreRefreshFocus && document.activeElement === document.body) refresh.focus({ preventScroll: true });
    }
  }
  refresh.addEventListener('click', () => { void refreshBoard(true); });
  window.addEventListener('popstate', restore);
  restore(); freshness();
  window.setInterval(() => { freshness(); void refreshBoard(false); }, 60000);
}
const root = document.querySelector<HTMLElement>('[data-model-board]');
if (root) mount(root);
