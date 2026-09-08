# 상태판 v2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/status/`가 종합·코딩·에이전트·속도·가성비 축마다 지금 제일인 모델을 숫자 없이도 보여주고, Terminal-Bench 4.0과 실시간 속도가 실제 값으로 채워지게 한다.

**Architecture:** 수집은 `scripts/status/*.mjs`(Node, 의존성 없음)가 30분마다 `public/data/model-board.json`(schema v2)을 갱신한다. 화면 규칙(변형 접기·순위·Pareto·강점 라벨·지문)은 순수 JS `src/lib/model-board-rules.mjs`에 두고 Astro 서버 렌더·브라우저·Node 테스트가 같이 쓴다. Astro 컴포넌트가 초기 HTML을 그리고 `src/lib/model-board-*.ts`가 같은 구조를 브라우저에서 다시 그린다.

**Tech Stack:** Astro 5, `astro/zod`, Node 20+(로컬)/22(워크플로), `node --test`, Playwright(`/home/seory0/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`, 크로미움은 `/usr/bin/google-chrome`).

Spec: `docs/superpowers/specs/2026-09-09-status-board-v2-design.md`.

## Global Constraints

- 새 npm 의존성 없음. API 키·토큰 없음.
- 합산 점수(DADES score)를 만들지 않는다. 지수는 원래 척도 그대로.
- 값이 없으면 0·추정값이 아니라 null이고 화면에는 `–` 또는 점선 윤곽.
- 수집 실패 시 이전 관측을 필드군 단위로 통째로 유지한다(`keepFields` 패턴).
- 허용 호스트는 `openrouter.ai`, `www.tbench.ai` 둘뿐. 리다이렉트가 요청 호스트를 벗어나면 거부.
- nav·홈·다른 라우트·글래스 재질·`.github/workflows/model-board.yml`은 건드리지 않는다.
- 화면 문구는 한국어, 짧게. 새 헤더·설명 문단을 늘리지 않는다.
- 커밋 메시지는 한국어 한 줄 + 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 작업 브랜치 `improve/status-board-v2`(이미 존재, spec 커밋됨). `gh`는 `GIT_CONFIG_NOSYSTEM=1`을 앞에 붙여 실행.
- 검증 명령: `npm test`(단위), `npx tsc --noEmit -p tsconfig.json`(타입), `npm run build`(빌드), `npm run test:site`(프리뷰 서버 4321 필요).

## File Structure

새 파일:

| 파일 | 책임 |
| --- | --- |
| `scripts/status/flight.mjs` | Next.js flight 스트림(`self.__next_f.push`)을 `id → JSON` 레코드로 푸는 공용 파서와 객체 탐색 |
| `scripts/status/terminal-bench.mjs` | tbench.ai 4.0 리더보드 파싱·검증·OpenRouter 모델 매핑 |
| `scripts/status/performance.mjs` | OpenRouter 모델 페이지의 제공사별 p50 통계 파싱, 샘플 선정 |
| `config/status.aliases.json` | Terminal-Bench 모델명 → OpenRouter ID 수동 별칭 |
| `tests/fixtures/status/tbench-4.0.html` | 2026-09-08 tbench.ai 페이지에서 리더보드 레코드만 남긴 축약본(이미 생성됨) |
| `tests/fixtures/status/openrouter-claude-opus-5.html` | 2026-09-08 OpenRouter Opus 5 페이지에서 endpoint 통계 쿼리만 남긴 축약본(이미 생성됨) |
| `src/lib/model-board-rules.mjs` | 변형 접기, 축 값, 순위, Pareto 전선, 가성비, 강점 라벨, 지문 스케일 (순수 JS) |
| `src/lib/model-board-rules.d.mts` | 위 모듈의 타입 선언 |
| `src/components/status/Fingerprint.astro` | 세 막대 지문 |
| `src/components/status/TerminalBenchPanel.astro` | Terminal-Bench 4.0 상위 패널 |
| `tests/model-board-rules.test.mjs` | 화면 규칙 단위 테스트 |
| `artifacts/qa/status-v2-capture.cjs` | Playwright 캡처 스크립트 |

수정: `scripts/status/rankings.mjs`, `scripts/status/catalog.mjs`, `scripts/status/refresh.mjs`, `scripts/status/cli.mjs`, `tests/status-data.test.mjs`, `tests/site-contract.test.mjs`, `src/lib/model-board.ts`, `src/lib/model-board-render.ts`, `src/lib/model-board-charts.ts`, `src/lib/model-board-client.ts`, `src/pages/status.astro`, `src/components/status/ModelRow.astro`, `src/components/status/BoardCharts.astro`, `src/styles/model-board.css`, `docs/status-data.md`, `docs/status-research.md`, `public/data/model-board.json`.

---

### Task 1: flight 파서 분리와 픽스처 커밋

**Files:**
- Create: `scripts/status/flight.mjs`
- Modify: `scripts/status/rankings.mjs` (`publishedRecords` 함수 제거, import로 대체)
- Commit as-is: `tests/fixtures/status/tbench-4.0.html`, `tests/fixtures/status/openrouter-claude-opus-5.html`
- Test: `tests/status-data.test.mjs`

**Interfaces:**
- Produces: `flightRecords(html: string): Map<string, unknown>` — 스크립트 태그의 push 조각을 합쳐 `id:JSON` 줄만 파싱. HTML이 문자열이 아니면 `Error('Response is not HTML.')`.
- Produces: `findObject(value, predicate, depth?)` — 깊이 우선으로 `predicate(obj)`가 참인 첫 비배열 객체. 없으면 null.
- Produces: `findInRecords(records, predicate)` — 모든 레코드에 `findObject`를 적용해 첫 결과.

- [ ] **Step 1: 픽스처가 이미 있는지 확인**

Run: `ls -la tests/fixtures/status/`
Expected: `tbench-4.0.html`(약 27KB), `openrouter-claude-opus-5.html`(약 9.7KB). 없으면 `/tmp/tb.html`, `/tmp/orpage.html`은 이미 사라졌을 수 있으므로 아래로 다시 만든다.

```bash
curl -s -L -A "Mozilla/5.0" "https://www.tbench.ai/leaderboard/terminal-bench/4.0" -o /tmp/tb.html
curl -s -L -A "Mozilla/5.0" "https://openrouter.ai/anthropic/claude-opus-5" -o /tmp/orpage.html
python3 - <<'EOF'
import re, json
def lines(path):
    s = open(path, encoding='utf-8', errors='ignore').read(); buf = ''
    for c in re.findall(r'self\.__next_f\.push\((\[.*?\])\)</script>', s, flags=re.S):
        try:
            arr = json.loads(c)
            if arr[0] == 1 and isinstance(arr[1], str): buf += arr[1]
        except Exception: pass
    return buf.split('\n')
def html(title, payload):
    return '<!DOCTYPE html><html><head><title>%s</title></head><body><script>self.__next_f.push([1,%s])</script></body></html>\n' % (title, json.dumps(payload))
tb = [l for l in lines('/tmp/tb.html') if re.match(r'^[\da-f]+:[\[{]', l) and '"leaderboard"' in l and '"rows"' in l]
open('tests/fixtures/status/tbench-4.0.html', 'w').write(html('TERMINAL-BENCH fixture', '\n'.join(tb) + '\n'))
q = None
for l in lines('/tmp/orpage.html'):
    m = re.match(r'^([\da-f]+):(.*)$', l)
    if not m or 'providerTableEndpointStats' not in l: continue
    def find(o):
        if isinstance(o, dict):
            if isinstance(o.get('queryKey'), list) and o['queryKey'][:2] == ['model-page', 'providerTableEndpointStats']: return o
            for v in o.values():
                r = find(v)
                if r: return r
        elif isinstance(o, list):
            for v in o:
                r = find(v)
                if r: return r
    q = find(json.loads(m.group(2)))
    if q: break
keys = ['id','name','provider_name','provider_display_name','provider_slug','variant','model_variant_slug','model_variant_permaslug','is_free','is_deranked','is_disabled','is_hidden','is_byok_only','quantization','stats']
data = [{k: e.get(k) for k in keys} for e in q['state']['data']]
record = ['$', '$L1e', None, {'state': {'mutations': [], 'queries': [{'queryKey': q['queryKey'], 'state': {'data': data, 'status': 'success'}}]}}]
open('tests/fixtures/status/openrouter-claude-opus-5.html', 'w').write(html('Claude Opus 5 fixture', '1d:' + json.dumps(record, separators=(',', ':')) + '\n'))
EOF
```

주의: 다시 만들면 값이 오늘 관측값으로 바뀌므로 Task 2·3의 기대값(58.18, 32605 등)을 실제 값으로 고쳐야 한다. 이미 있는 픽스처를 쓰는 것이 우선이다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/status-data.test.mjs` 맨 위 import 아래에 추가:

```js
import { findInRecords, flightRecords } from '../scripts/status/flight.mjs';

function flightHtml(stream, splitAt = 7) {
  return [stream.slice(0, splitAt), stream.slice(splitAt)].map((chunk) => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('<script>self.__next_f.push([0])</script>');
}

test('flight parser joins split push chunks into JSON records and skips transport lines', () => {
  const records = flightRecords(flightHtml('1:"$Sreact.fragment"\na:{"state":{"queries":[{"queryKey":["x"],"state":{"data":[1,2]}}]}}\nb:I[123,[]]\n'));
  assert.deepEqual([...records.keys()], ['a']);
  assert.deepEqual(findInRecords(records, (value) => Array.isArray(value.queryKey)).state.data, [1, 2]);
  assert.equal(findInRecords(records, (value) => value.missing === true), null);
  assert.throws(() => flightRecords(null), /not HTML/);
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -5`
Expected: import 단계에서 `Cannot find module '.../scripts/status/flight.mjs'` 오류.

- [ ] **Step 4: `scripts/status/flight.mjs` 작성**

```js
export function flightRecords(html) {
  if (typeof html !== 'string') throw new Error('Response is not HTML.');
  const chunks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].flatMap(([, script]) => {
    const match = /^self\.__next_f\.push\(([\s\S]+)\);?$/.exec(script.trim());
    if (!match) return [];
    const push = JSON.parse(match[1]);
    return push[0] === 1 && typeof push[1] === 'string' ? [push[1]] : [];
  });
  const records = new Map();
  for (const line of chunks.join('').split('\n')) {
    const match = /^([\da-f]+):(\[.*|\{.*)$/.exec(line);
    if (!match) continue;
    try {
      records.set(match[1], JSON.parse(match[2]));
    } catch {
      // React's stream also contains transport records; only JSON records are data.
    }
  }
  return records;
}

export function findObject(value, predicate, depth = 0) {
  if (depth > 64 || value === null || typeof value !== 'object') return null;
  if (!Array.isArray(value) && predicate(value)) return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findObject(child, predicate, depth + 1);
    if (found) return found;
  }
  return null;
}

export function findInRecords(records, predicate) {
  for (const record of records.values()) {
    const found = findObject(record, predicate);
    if (found) return found;
  }
  return null;
}
```

- [ ] **Step 5: `rankings.mjs`가 공용 파서를 쓰게 수정**

`scripts/status/rankings.mjs`에서 `function publishedRecords(html) { ... }` 전체(약 20줄)를 삭제하고, 파일 맨 위 import를 아래로 바꾼다.

```js
import { numberOrNull } from './catalog.mjs';
import { flightRecords } from './flight.mjs';
```

`parseRankings` 첫 줄 `const records = publishedRecords(html);`를 `const records = flightRecords(html);`로 바꾼다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -8`
Expected: `# pass 45`, `# fail 0`.

- [ ] **Step 7: 커밋**

```bash
git add scripts/status/flight.mjs scripts/status/rankings.mjs tests/status-data.test.mjs tests/fixtures/status/
git commit -m "상태판 수집기 flight 파서 분리와 리더보드·모델 페이지 픽스처

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Terminal-Bench 4.0 어댑터

**Files:**
- Create: `scripts/status/terminal-bench.mjs`
- Modify: `scripts/status/catalog.mjs` (`isCanonicalId` export 추가)
- Test: `tests/status-data.test.mjs`

**Interfaces:**
- Consumes: `flightRecords`, `findInRecords` (Task 1), `numberOrNull` (`catalog.mjs`).
- Produces: `TERMINAL_BENCH_URL`, `nameKey(value): string`, `parseTerminalBench(html) → { title, url, updatedAt, rows }`, `matchTerminalBench(leaderboard, models, aliases?) → { title, url, updatedAt, rows(with modelId), byId: Map<id, {accuracy, ci95, agent, effort, date}>, mapped }`.
- Row 형: `{ rank, model, modelUrl, agent, agentOrg, modelOrg, effort, accuracy, ci95, date, trials, modelId }`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/status-data.test.mjs` import 구역에 추가:

```js
import { readFile } from 'node:fs/promises';
import { matchTerminalBench, parseTerminalBench } from '../scripts/status/terminal-bench.mjs';

const tbenchHtml = await readFile(new URL('./fixtures/status/tbench-4.0.html', import.meta.url), 'utf8');

function terminalBenchHtml({ name = '4-0-0', title = 'Terminal-Bench 4.0', rows = [] } = {}) {
  const record = ['$', '$L1e', null, { state: { queries: [{ queryKey: ['leaderboard'], state: { data: { leaderboard: { title, name, updated_at: '2026-09-03T21:34:07.080891+00:00' }, rows } } }] } }];
  return `<script>self.__next_f.push(${JSON.stringify([1, `1d:${JSON.stringify(record)}\n`])})</script>`;
}
const tbRow = (overrides = {}) => ({
  rank: 1,
  metadata: { date: '2026-09-03', model_display: { label: 'Example Model', url: 'https://example.com/model' }, agent_display: { label: 'Example Agent', url: 'https://example.com/agent' }, agent_org: { label: 'Example' }, model_org: { label: 'Example' }, reasoning_effort: 'high' },
  metrics: { accuracy: 42.5, accuracy_ci95_half_width: 3, n_trials: 330 },
  ...overrides,
});
const tbMeta = (overrides) => ({ ...tbRow().metadata, ...overrides });
```

파일 끝에 테스트 추가:

```js
test('terminal-bench parser reads the published 4.0 leaderboard rows with their agent and confidence interval', () => {
  const board = parseTerminalBench(tbenchHtml);
  assert.equal(board.title, 'Terminal-Bench 4.0');
  assert.equal(board.url, 'https://www.tbench.ai/leaderboard/terminal-bench/4.0');
  assert.equal(board.updatedAt, '2026-09-03T21:34:07.080Z');
  assert.equal(board.rows.length, 18);
  assert.deepEqual(board.rows[0], { rank: 1, model: 'GPT-6 Astra', modelUrl: 'https://developers.openai.com/api/docs/models/gpt-6-astra', agent: 'Codex', agentOrg: 'OpenAI', modelOrg: 'OpenAI', effort: 'max', accuracy: 58.18, ci95: 2.79, date: '2026-09-03', trials: 330, modelId: null });
});

test('terminal-bench parser rejects another leaderboard version, empty rows, incomplete rows, and pages without data', () => {
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ name: '2-1-0', rows: [tbRow()] })), /Unexpected Terminal-Bench leaderboard/);
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ rows: [] })), /no rows/);
  assert.throws(() => parseTerminalBench(terminalBenchHtml({ rows: [tbRow({ metrics: { accuracy: null } })] })), /incomplete/);
  assert.throws(() => parseTerminalBench('<html></html>'), /unavailable/);
});

test('terminal-bench matching uses exact or suffix name matches inside the model organisation namespace and keeps the best row', () => {
  const models = [
    { id: 'anthropic/claude-opus-5', name: 'Anthropic: Claude Opus 5' }, { id: 'anthropic/claude-opus-5:batch', name: 'Anthropic: Claude Opus 5 (batch)' },
    { id: 'openai/gpt-6-astra', name: 'OpenAI: GPT-6 Astra' }, { id: 'other/opus-5', name: 'Other: Opus 5' },
  ];
  const board = parseTerminalBench(terminalBenchHtml({ rows: [
    tbRow({ rank: 1, metadata: tbMeta({ model_display: { label: 'Opus 5' }, model_org: { label: 'Anthropic' }, reasoning_effort: 'max' }), metrics: { accuracy: 51.8, accuracy_ci95_half_width: 3.4 } }),
    tbRow({ rank: 2, metadata: tbMeta({ model_display: { label: 'Opus 5' }, model_org: { label: 'Anthropic' }, reasoning_effort: 'high' }), metrics: { accuracy: 60, accuracy_ci95_half_width: 3 } }),
    tbRow({ rank: 3, metadata: tbMeta({ model_display: { label: 'GPT-6 Astra' }, model_org: { label: 'OpenAI' } }), metrics: { accuracy: 58.2 } }),
    tbRow({ rank: 4, metadata: tbMeta({ model_display: { label: 'Mystery' }, model_org: { label: 'Nobody' } }), metrics: { accuracy: 10 } }),
  ] }));
  const matched = matchTerminalBench(board, models);
  assert.deepEqual(matched.rows.map((row) => row.modelId), ['anthropic/claude-opus-5', 'anthropic/claude-opus-5', 'openai/gpt-6-astra', null]);
  assert.deepEqual(matched.byId.get('anthropic/claude-opus-5'), { accuracy: 60, ci95: 3, agent: 'Example Agent', effort: 'high', date: '2026-09-03' });
  assert.equal(matched.mapped, 3);
  assert.equal(matched.updatedAt, board.updatedAt);
});

test('terminal-bench matching falls back to aliases for ambiguous labels and ignores alias targets missing from the catalog', () => {
  const models = [{ id: 'google/gemini-3.8-flash', name: 'Google: Gemini 3.8 Flash' }, { id: 'google/gemini-3.7-flash', name: 'Google: Gemini 3.7 Flash' }];
  const board = parseTerminalBench(terminalBenchHtml({ rows: [tbRow({ metadata: tbMeta({ model_display: { label: 'Flash' }, model_org: { label: 'Google' } }) })] }));
  assert.equal(matchTerminalBench(board, models).rows[0].modelId, null);
  assert.equal(matchTerminalBench(board, models, { Flash: 'google/gemini-3.8-flash' }).rows[0].modelId, 'google/gemini-3.8-flash');
  assert.equal(matchTerminalBench(board, models, { Flash: 'google/missing' }).rows[0].modelId, null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -5`
Expected: `Cannot find module '.../terminal-bench.mjs'`.

- [ ] **Step 3: `catalog.mjs`에 `isCanonicalId` 추가**

`scripts/status/catalog.mjs`의 `export function numberOrNull` 바로 위에 추가:

```js
export const isCanonicalId = (id) => !id.startsWith('~') && !id.includes(':');
```

- [ ] **Step 4: `scripts/status/terminal-bench.mjs` 작성**

```js
import { isCanonicalId, numberOrNull } from './catalog.mjs';
import { findInRecords, flightRecords } from './flight.mjs';

export const TERMINAL_BENCH_URL = 'https://www.tbench.ai/leaderboard/terminal-bench/4.0';
const LEADERBOARD_NAME = '4-0-0';
const ORG_NAMESPACES = new Map(Object.entries({
  openai: 'openai', anthropic: 'anthropic', google: 'google', 'google deepmind': 'google', xai: 'x-ai', 'z.ai': 'z-ai', zhipu: 'z-ai',
  moonshot: 'moonshotai', 'moonshot ai': 'moonshotai', deepseek: 'deepseek', alibaba: 'qwen', qwen: 'qwen', meta: 'meta',
  minimax: 'minimax', mistral: 'mistralai', 'mistral ai': 'mistralai',
}));

export const nameKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const label = (display) => text(display?.label);
function link(display) {
  try {
    const url = new URL(display?.url);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseTerminalBench(html) {
  const found = findInRecords(flightRecords(html), (value) => value.leaderboard && typeof value.leaderboard === 'object' && Array.isArray(value.rows));
  if (!found) throw new Error('Terminal-Bench leaderboard data is unavailable.');
  const { leaderboard, rows } = found;
  if (typeof leaderboard.title !== 'string' || !leaderboard.title.startsWith('Terminal-Bench') || leaderboard.name !== LEADERBOARD_NAME) {
    throw new Error(`Unexpected Terminal-Bench leaderboard: ${leaderboard.title ?? 'untitled'} (${leaderboard.name ?? 'unnamed'}).`);
  }
  if (rows.length === 0) throw new Error('Terminal-Bench leaderboard has no rows.');
  const updatedAt = new Date(leaderboard.updated_at ?? NaN);
  if (Number.isNaN(updatedAt.getTime())) throw new Error('Terminal-Bench leaderboard has no update time.');
  const parsed = rows.map((row) => {
    const meta = row.metadata ?? {};
    const metrics = row.metrics ?? {};
    const accuracy = numberOrNull(metrics.accuracy);
    const model = label(meta.model_display);
    const agent = label(meta.agent_display);
    if (accuracy === null || accuracy > 100 || !model || !agent || !Number.isInteger(row.rank) || row.rank < 1 || typeof meta.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
      throw new Error('Terminal-Bench row is incomplete.');
    }
    return {
      rank: row.rank, model, modelUrl: link(meta.model_display), agent, agentOrg: label(meta.agent_org), modelOrg: label(meta.model_org),
      effort: text(meta.reasoning_effort), accuracy, ci95: numberOrNull(metrics.accuracy_ci95_half_width), date: meta.date, trials: numberOrNull(metrics.n_trials), modelId: null,
    };
  }).sort((a, b) => a.rank - b.rank || b.accuracy - a.accuracy || a.model.localeCompare(b.model));
  return { title: leaderboard.title, url: TERMINAL_BENCH_URL, updatedAt: updatedAt.toISOString(), rows: parsed };
}

export function matchTerminalBench(leaderboard, models, aliases = {}) {
  const canonical = models.filter((model) => isCanonicalId(model.id));
  const byId = new Map();
  const rows = leaderboard.rows.map((row) => {
    const namespace = ORG_NAMESPACES.get((row.modelOrg ?? '').toLowerCase()) ?? null;
    const key = nameKey(row.model);
    const pool = namespace ? canonical.filter((model) => model.id.split('/')[0] === namespace) : canonical;
    const hits = pool.filter((model) => {
      const candidate = nameKey(model.name.replace(/^[^:]+:\s*/, ''));
      return candidate === key || candidate.endsWith(key);
    });
    let modelId = hits.length === 1 ? hits[0].id : null;
    const alias = aliases[row.model];
    if (!modelId && typeof alias === 'string' && canonical.some((model) => model.id === alias)) modelId = alias;
    if (modelId) {
      const current = byId.get(modelId);
      if (!current || row.accuracy > current.accuracy) byId.set(modelId, { accuracy: row.accuracy, ci95: row.ci95, agent: row.agent, effort: row.effort, date: row.date });
    }
    return { ...row, modelId };
  });
  return { title: leaderboard.title, url: leaderboard.url, updatedAt: leaderboard.updatedAt, rows, byId, mapped: rows.filter((row) => row.modelId !== null).length };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -8`
Expected: `# pass 49`, `# fail 0`.

- [ ] **Step 6: 커밋**

```bash
git add scripts/status/terminal-bench.mjs scripts/status/catalog.mjs tests/status-data.test.mjs
git commit -m "Terminal-Bench 4.0 공식 리더보드 수집기 — 파싱·검증·OpenRouter 모델 매핑

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: OpenRouter 모델 페이지 속도 어댑터

**Files:**
- Create: `scripts/status/performance.mjs`
- Modify: `scripts/status/catalog.mjs` (새 null 필드 추가)
- Test: `tests/status-data.test.mjs` (문서화 API 테스트 5개 삭제, 새 테스트 추가)

**Interfaces:**
- Produces: `performanceSample(models, limit = 32)` — 정식 모델 중 종합 상위 16 + 사용량 상위 16 + 나머지 채움.
- Produces: `parseModelPage(html, modelId) → { speed, latency, speedProvider, speedRequests, speedWindow }` (후보 없으면 전부 null; 통계 쿼리가 없거나 변형/모델이 다르면 throw).
- `parseCatalog` 결과 모델에 `terminalBench: null, speedRequests: null, speedWindow: null`이 추가된다.

- [ ] **Step 1: 문서화 API 테스트 삭제**

`tests/status-data.test.mjs`에서 아래 5개 테스트를 통째로 지운다.

- `performance requests only follow published matching HTTPS details links`
- `performance uses speed and latency from one named endpoint without mixing providers`
- `performance reads the documented p50 percentile from both endpoint metrics`
- `performance leaves a missing p50 unknown instead of substituting another percentile`
- `performance rejects model mismatch and treats missing throughput as unavailable`

맨 위 import를 `import { numberOrNull, parseCatalog } from '../scripts/status/catalog.mjs';`로 바꾼다.

- [ ] **Step 2: 실패하는 테스트 작성**

import 구역에 추가:

```js
import { parseModelPage, performanceSample } from '../scripts/status/performance.mjs';

const openRouterHtml = await readFile(new URL('./fixtures/status/openrouter-claude-opus-5.html', import.meta.url), 'utf8');

function modelPageHtml(modelId, endpoints, variant = 'standard') {
  const query = { queryKey: ['model-page', 'providerTableEndpointStats', { permaslug: `${modelId}-20260101`, variant, perfWorkload: 'text_generation', latencyMetric: 'latency' }], state: { data: endpoints } };
  const record = ['$', '$L1e', null, { state: { mutations: [], queries: [query] } }];
  return `<script>self.__next_f.push(${JSON.stringify([1, `1d:${JSON.stringify(record)}\n`])})</script>`;
}
const endpoint = (overrides = {}) => ({
  provider_display_name: 'Example Cloud', provider_slug: 'example', variant: 'standard', model_variant_slug: 'example/model',
  is_free: false, is_deranked: false, is_disabled: false, is_hidden: false, is_byok_only: false,
  stats: { p50_throughput: 55, p50_latency: 1200, throughput_request_count: 100, window_minutes: 30 }, ...overrides,
});
const stats = (overrides) => ({ p50_throughput: 55, p50_latency: 1200, throughput_request_count: 100, window_minutes: 30, ...overrides });
```

파일 끝에 추가:

```js
test('catalog initialises the v2 observation fields as unknown', () => {
  const [model] = parseCatalog({ data: [catalogRow()] });
  assert.deepEqual([model.terminalBench, model.speedRequests, model.speedWindow], [null, null, null]);
});

test('model page performance picks the standard endpoint with the most requests and converts latency to seconds', () => {
  assert.deepEqual(parseModelPage(openRouterHtml, 'anthropic/claude-opus-5'), { speed: 51, latency: 5.129, speedProvider: 'Claude Platform on AWS', speedRequests: 32605, speedWindow: 30 });
});

test('model page performance skips free, deranked, disabled, hidden, BYOK, quiet, and unmeasured endpoints', () => {
  const html = modelPageHtml('example/model', [
    endpoint({ provider_slug: 'free', is_free: true, stats: stats({ p50_throughput: 900, throughput_request_count: 9000 }) }),
    endpoint({ provider_slug: 'deranked', is_deranked: true, stats: stats({ p50_throughput: 900, throughput_request_count: 9000 }) }),
    endpoint({ provider_slug: 'disabled', is_disabled: true, stats: stats({ throughput_request_count: 9000 }) }),
    endpoint({ provider_slug: 'hidden', is_hidden: true, stats: stats({ throughput_request_count: 9000 }) }),
    endpoint({ provider_slug: 'byok', is_byok_only: true, stats: stats({ throughput_request_count: 9000 }) }),
    endpoint({ provider_slug: 'quiet', stats: stats({ p50_throughput: 900, throughput_request_count: 0 }) }),
    endpoint({ provider_slug: 'silent', stats: null }),
    endpoint({ provider_slug: 'busy', provider_display_name: 'Busy Cloud', stats: stats({ p50_throughput: 40, p50_latency: null, throughput_request_count: 500 }) }),
    endpoint(),
  ]);
  assert.deepEqual(parseModelPage(html, 'example/model'), { speed: 40, latency: null, speedProvider: 'Busy Cloud', speedRequests: 500, speedWindow: 30 });
});

test('model page performance breaks request ties by throughput then provider slug and returns nulls without candidates', () => {
  const tie = modelPageHtml('example/model', [
    endpoint({ provider_slug: 'b', provider_display_name: 'B', stats: stats({ p50_throughput: 70 }) }),
    endpoint({ provider_slug: 'a', provider_display_name: 'A', stats: stats({ p50_throughput: 70 }) }),
    endpoint({ provider_slug: 'c', provider_display_name: 'C', stats: stats({ p50_throughput: 60 }) }),
  ]);
  assert.equal(parseModelPage(tie, 'example/model').speedProvider, 'A');
  assert.deepEqual(parseModelPage(modelPageHtml('example/model', []), 'example/model'), { speed: null, latency: null, speedProvider: null, speedRequests: null, speedWindow: null });
});

test('model page performance rejects pages without statistics, other variants, and other models', () => {
  assert.throws(() => parseModelPage('<html></html>', 'example/model'), /no endpoint statistics/);
  assert.throws(() => parseModelPage(modelPageHtml('example/model', [endpoint()], 'free'), 'example/model'), /variant/);
  assert.throws(() => parseModelPage(modelPageHtml('example/model', [endpoint({ model_variant_slug: 'other/model' })]), 'example/model'), /do not belong/);
});

test('performance sample prefers leading intelligence and usage models and skips variants', () => {
  const models = [...Array(40)].map((_, index) => ({ id: `example/model-${index}`, intelligence: index, tokens7d: 40 - index }));
  models.push({ id: 'example/model-39:batch', intelligence: 99, tokens7d: 99 }, { id: '~example/alias', intelligence: 99, tokens7d: 99 });
  const sample = performanceSample(models);
  assert.equal(sample.length, 32);
  assert.ok(sample.every((model) => !model.id.includes(':') && !model.id.startsWith('~')));
  assert.ok(sample.slice(0, 16).every((model) => model.intelligence >= 24));
  assert.ok(sample.slice(16).every((model) => model.tokens7d >= 25));
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -5`
Expected: `Cannot find module '.../performance.mjs'`.

- [ ] **Step 4: `catalog.mjs`에 v2 필드 추가**

`scripts/status/catalog.mjs`의 `parseCatalog` 반환 객체에서 `speedProvider: null,` 다음 줄에 아래 세 줄을 추가한다. (`endpointRequests`·`parseEndpoint` 삭제는 `refresh.mjs`가 아직 import하므로 Task 4에서 한다.)

```js
      speedRequests: null,
      speedWindow: null,
      terminalBench: null,
```

- [ ] **Step 5: `scripts/status/performance.mjs` 작성**

```js
import { isCanonicalId, numberOrNull } from './catalog.mjs';
import { findInRecords, flightRecords } from './flight.mjs';

export const EMPTY_PERFORMANCE = Object.freeze({ speed: null, latency: null, speedProvider: null, speedRequests: null, speedWindow: null });

export function performanceSample(models, limit = 32) {
  const eligible = models.filter((model) => isCanonicalId(model.id));
  const byMetric = (key) => eligible.filter((model) => model[key] !== null && model[key] !== undefined).sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id));
  const candidates = [...byMetric('intelligence').slice(0, 16), ...byMetric('tokens7d').slice(0, 16), ...byMetric('intelligence'), ...eligible];
  const seen = new Set();
  return candidates.filter((model) => !seen.has(model.id) && seen.add(model.id)).slice(0, limit);
}

export function parseModelPage(html, modelId) {
  const query = findInRecords(flightRecords(html), (value) => Array.isArray(value.queryKey) && value.queryKey[0] === 'model-page' && value.queryKey[1] === 'providerTableEndpointStats');
  if (!query) throw new Error(`Model page for ${modelId} has no endpoint statistics.`);
  const variant = query.queryKey[2]?.variant;
  if (variant !== 'standard') throw new Error(`Model page for ${modelId} reports the ${variant ?? 'unknown'} variant.`);
  const endpoints = query.state?.data;
  if (!Array.isArray(endpoints)) throw new Error(`Model page for ${modelId} has malformed endpoint statistics.`);
  if (endpoints.some((endpoint) => endpoint?.model_variant_slug !== modelId)) throw new Error(`Model page endpoints do not belong to ${modelId}.`);
  const candidates = endpoints.flatMap((endpoint) => {
    const stats = endpoint.stats;
    const speed = numberOrNull(stats?.p50_throughput);
    const requests = numberOrNull(stats?.throughput_request_count);
    const provider = typeof endpoint.provider_display_name === 'string' ? endpoint.provider_display_name.trim() : '';
    const slug = typeof endpoint.provider_slug === 'string' ? endpoint.provider_slug : '';
    if (endpoint.variant !== 'standard' || !provider || !slug || speed === null || speed <= 0 || requests === null || requests < 1) return [];
    if ([endpoint.is_free, endpoint.is_deranked, endpoint.is_disabled, endpoint.is_hidden, endpoint.is_byok_only].some(Boolean)) return [];
    const latency = numberOrNull(stats.p50_latency);
    return [{ speed, latency: latency === null ? null : latency / 1000, speedProvider: provider, speedRequests: requests, speedWindow: numberOrNull(stats.window_minutes), slug }];
  });
  candidates.sort((a, b) => b.speedRequests - a.speedRequests || b.speed - a.speed || a.slug.localeCompare(b.slug));
  if (!candidates[0]) return { ...EMPTY_PERFORMANCE };
  const { slug, ...chosen } = candidates[0];
  return chosen;
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | tail -8`
Expected: `# pass 50`, `# fail 0`.

- [ ] **Step 7: 커밋**

```bash
git add scripts/status/performance.mjs scripts/status/catalog.mjs tests/status-data.test.mjs
git commit -m "OpenRouter 모델 페이지 속도 어댑터 — 트래픽 최다 제공사 p50, 문서화 API 경로 제거

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: refresh·cli 통합과 스냅샷 스키마 v2

**Files:**
- Modify: `scripts/status/refresh.mjs` (전체 교체)
- Modify: `scripts/status/cli.mjs` (전체 교체)
- Modify: `scripts/status/catalog.mjs` (`endpointRequests`·`parseEndpoint` 삭제)
- Create: `config/status.aliases.json`
- Test: `tests/status-data.test.mjs`

**Interfaces:**
- Consumes: Task 2 `parseTerminalBench`/`matchTerminalBench`/`TERMINAL_BENCH_URL`, Task 3 `parseModelPage`/`performanceSample`/`EMPTY_PERFORMANCE`.
- Produces: `SCHEMA_VERSION = 2`, `fetchSource(url, transport?)`(`https://openrouter.ai/api/`는 JSON, 그 외는 HTML 문자열), `upgradeSnapshot(snapshot)`(v1→v2, 그 외 throw), `refreshSnapshot({ previous, transport, now, aliases })` → `{ schemaVersion: 2, fetchedAt, sources[5], terminalBench, models }`.
- 출처 id 순서: `openrouter-catalog`, `artificial-analysis`, `terminal-bench`, `openrouter-performance`, `openrouter-usage`.

- [ ] **Step 1: 기존 테스트를 v2에 맞게 고친다**

`tests/status-data.test.mjs`의 refresh import를 `import { fetchSource, refreshSnapshot, upgradeSnapshot } from '../scripts/status/refresh.mjs';`로 바꾼다.

`previousSnapshot()`을 아래로 교체:

```js
function previousSnapshot() {
  const observedAt = '2026-09-01T00:00:00.000Z';
  return {
    schemaVersion: 2, fetchedAt: observedAt,
    sources: ['openrouter-catalog', 'artificial-analysis', 'terminal-bench', 'openrouter-performance', 'openrouter-usage'].map((id) => ({ id, label: id, url: 'https://openrouter.ai/rankings', status: 'ok', observedAt, note: '' })),
    terminalBench: { title: 'Terminal-Bench 4.0', url: 'https://www.tbench.ai/leaderboard/terminal-bench/4.0', updatedAt: observedAt, rows: [] },
    models: parseCatalog({ data: [catalogRow()] }).map((model) => ({
      ...model, intelligence: 40, speed: 55, latency: 1.2, speedProvider: 'Example Cloud', speedRequests: 12, speedWindow: 30,
      terminalBench: { accuracy: 50, ci95: 2, agent: 'Example Agent', effort: 'high', date: '2026-09-01' },
      tokens7d: 1000, previousTokens7d: 800, dailyTokens: [{ date: '2026-08-31', tokens: 1000 }],
    })),
  };
}
```

`a partial outage refreshes catalog values while retaining failed sources and timestamps`에서:
- `for (const field of ['tokens7d', 'previousTokens7d', 'dailyTokens', 'speed', 'latency', 'speedProvider'])` → `['tokens7d', 'previousTokens7d', 'dailyTokens', 'speed', 'latency', 'speedProvider', 'speedRequests', 'speedWindow', 'terminalBench']`
- `for (const id of ['openrouter-performance', 'openrouter-usage'])` → `['terminal-bench', 'openrouter-performance', 'openrouter-usage']`
- 마지막 assert 뒤에 `assert.deepEqual(result.terminalBench, previous.terminalBench);` 추가.

`a complete upstream outage keeps the full last successful dataset`의 `assert.deepEqual(result.models, previous.models);` 다음 줄에 `assert.deepEqual(result.terminalBench, previous.terminalBench);` 추가.

`a usable usage source refreshes independently when performance has no observations`의 transport 마지막 줄 `return new Response(JSON.stringify({ data: { id: 'example/model', endpoints: [] } }));`를 `return new Response(modelPageHtml('example/model', []));`로 바꾸고, 마지막 assert 뒤에 `assert.equal(result.sources.find((source) => source.id === 'terminal-bench').status, 'unavailable');` 추가.

`one failed performance endpoint retains the entire earlier measurement batch` 테스트를 통째로 아래로 교체:

```js
test('one failed model page retains the entire earlier measurement batch even after a retry', async () => {
  const previous = previousSnapshot();
  const second = catalogRow({ id: 'example/second', canonical_slug: 'example/second-20260101' });
  previous.models.push({ ...parseCatalog({ data: [second] })[0], speed: 66, latency: 2, speedProvider: 'Second Cloud', speedRequests: 5, speedWindow: 30 });
  let secondCalls = 0;
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow(), second] }));
    if (url === 'https://openrouter.ai/example/model') return new Response(modelPageHtml('example/model', [endpoint({ stats: stats({ p50_throughput: 999 }) })]));
    if (url === 'https://openrouter.ai/example/second') secondCalls += 1;
    return new Response('', { status: 503 });
  };
  const result = await refreshSnapshot({ previous, transport });
  assert.equal(secondCalls, 2);
  assert.deepEqual(result.models.map((model) => model.speed), [55, 66]);
  assert.equal(result.sources.find((source) => source.id === 'openrouter-performance').observedAt, previous.fetchedAt);
});
```

- [ ] **Step 2: 새 테스트 추가 (파일 끝)**

```js
test('a retry recovers a flaky model page and publishes the fresh provider observation', async () => {
  let calls = 0;
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow()] }));
    if (url === 'https://openrouter.ai/example/model') {
      calls += 1;
      return calls === 1 ? new Response('', { status: 503 }) : new Response(modelPageHtml('example/model', [endpoint()]));
    }
    return new Response('', { status: 503 });
  };
  const result = await refreshSnapshot({ transport });
  const model = result.models[0];
  assert.deepEqual([model.speed, model.latency, model.speedProvider, model.speedRequests, model.speedWindow], [55, 1.2, 'Example Cloud', 100, 30]);
  assert.equal(result.sources.find((source) => source.id === 'openrouter-performance').status, 'ok');
});

test('a refreshed Terminal-Bench leaderboard attaches best rows to catalog models and reports the mapping count', async () => {
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow()] }));
    if (url === 'https://www.tbench.ai/leaderboard/terminal-bench/4.0') return new Response(terminalBenchHtml({ rows: [
      tbRow({ metadata: tbMeta({ model_display: { label: 'Model' } }) }),
      tbRow({ rank: 2, metadata: tbMeta({ model_display: { label: 'Unknown' } }), metrics: { accuracy: 5 } }),
    ] }));
    return new Response('', { status: 503 });
  };
  const result = await refreshSnapshot({ transport });
  assert.deepEqual(result.models[0].terminalBench, { accuracy: 42.5, ci95: 3, agent: 'Example Agent', effort: 'high', date: '2026-09-03' });
  assert.deepEqual(result.terminalBench.rows.map((row) => row.modelId), ['example/model', null]);
  const source = result.sources.find((entry) => entry.id === 'terminal-bench');
  assert.equal(source.status, 'ok');
  assert.equal(source.observedAt, '2026-09-03T21:34:07.080Z');
  assert.match(source.note, /1\/2 published/);
});

test('aliases resolve Terminal-Bench labels the name matcher cannot', async () => {
  const transport = async (url) => {
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify({ data: [catalogRow()] }));
    if (url === 'https://www.tbench.ai/leaderboard/terminal-bench/4.0') return new Response(terminalBenchHtml({ rows: [tbRow({ metadata: tbMeta({ model_display: { label: 'Codename' } }) })] }));
    return new Response('', { status: 503 });
  };
  const result = await refreshSnapshot({ transport, aliases: { terminalBench: { Codename: 'example/model' } } });
  assert.equal(result.models[0].terminalBench.accuracy, 42.5);
});

test('upgradeSnapshot converts a v1 snapshot and rejects unknown versions', () => {
  const v1 = { schemaVersion: 1, fetchedAt: '2026-09-01T00:00:00.000Z', sources: [], models: [{ id: 'example/model', speed: 1 }] };
  const upgraded = upgradeSnapshot(v1);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.terminalBench, null);
  assert.deepEqual(upgraded.models[0], { terminalBench: null, speedRequests: null, speedWindow: null, id: 'example/model', speed: 1 });
  assert.equal(upgradeSnapshot(upgraded), upgraded);
  assert.throws(() => upgradeSnapshot({ schemaVersion: 3, sources: [], models: [] }), /unsupported/);
  assert.throws(() => upgradeSnapshot({ schemaVersion: 2, models: [] }), /unsupported/);
});

test('source adapter returns HTML for page sources and rejects redirects to another allowed host', async () => {
  assert.equal(await fetchSource('https://www.tbench.ai/leaderboard/terminal-bench/4.0', async () => ({ ok: true, url: '', text: async () => '<html>' })), '<html>');
  await assert.rejects(fetchSource('https://openrouter.ai/rankings', async () => ({ ok: true, url: 'https://www.tbench.ai/x', text: async () => '' })), /outside the source domain/);
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail` ≥ 5 (upgradeSnapshot 미정의, 출처 5개 기대, 모델 페이지 URL 등).

- [ ] **Step 4: `scripts/status/refresh.mjs` 전체 교체**

```js
import { CATALOG_URL, parseCatalog } from './catalog.mjs';
import { parseRankings, RANKINGS_URL } from './rankings.mjs';
import { matchTerminalBench, parseTerminalBench, TERMINAL_BENCH_URL } from './terminal-bench.mjs';
import { EMPTY_PERFORMANCE, parseModelPage, performanceSample } from './performance.mjs';

export const SCHEMA_VERSION = 2;
const SOURCE_DETAILS = [
  { id: 'openrouter-catalog', label: 'OpenRouter catalog', url: CATALOG_URL },
  { id: 'artificial-analysis', label: 'Artificial Analysis via OpenRouter', url: CATALOG_URL },
  { id: 'terminal-bench', label: 'Terminal-Bench 4.0 leaderboard', url: TERMINAL_BENCH_URL },
  { id: 'openrouter-performance', label: 'OpenRouter model page performance', url: 'https://openrouter.ai/models' },
  { id: 'openrouter-usage', label: 'OpenRouter usage rankings', url: RANKINGS_URL },
];
const ALLOWED_HOSTS = new Set(['openrouter.ai', 'www.tbench.ai']);
const PERFORMANCE_FIELDS = ['speed', 'latency', 'speedProvider', 'speedRequests', 'speedWindow'];
const USAGE_FIELDS = ['tokens7d', 'previousTokens7d', 'dailyTokens'];
const BENCHMARK_FIELDS = ['intelligence', 'coding', 'agentic'];
const TERMINAL_BENCH_FIELDS = ['terminalBench'];

export async function fetchSource(url, transport = fetch) {
  const json = url.startsWith('https://openrouter.ai/api/');
  const response = await transport(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: json ? 'application/json' : 'text/html', 'user-agent': 'DADES-Model-Board/2.0 (+https://seory0.github.io/DADES/)' },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== new URL(url).hostname || !ALLOWED_HOSTS.has(finalUrl.hostname)) throw new Error('Upstream redirected outside the source domain.');
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Source exceeded the response size limit.');
  return json ? JSON.parse(text) : text;
}

export function upgradeSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.models) || !Array.isArray(snapshot.sources)) throw new Error('Existing status snapshot has an unsupported format.');
  if (snapshot.schemaVersion === SCHEMA_VERSION) return snapshot;
  if (snapshot.schemaVersion !== 1) throw new Error('Existing status snapshot has an unsupported format.');
  return { ...snapshot, schemaVersion: SCHEMA_VERSION, terminalBench: null, models: snapshot.models.map((model) => ({ terminalBench: null, speedRequests: null, speedWindow: null, ...model })) };
}

function keepFields(models, previous, fields) {
  const oldModels = new Map((previous?.models ?? []).map((model) => [model.id, model]));
  for (const model of models) {
    const old = oldModels.get(model.id);
    if (old) for (const field of fields) model[field] = structuredClone(old[field] ?? null);
  }
}

async function fetchWithRetry(url, transport) {
  try {
    return await fetchSource(url, transport);
  } catch {
    return fetchSource(url, transport);
  }
}

async function collectPerformance(models, transport) {
  const observations = new Map();
  for (let index = 0; index < models.length; index += 4) {
    const batch = models.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map(async (model) => parseModelPage(await fetchWithRetry(model.url, transport), model.id)));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    results.forEach((result, offset) => observations.set(batch[offset].id, result.value));
  }
  return observations;
}

export async function refreshSnapshot({ previous = null, transport = fetch, now = new Date(), aliases = {} } = {}) {
  const fetchedAt = now.toISOString();
  const sources = SOURCE_DETAILS.map((details) => ({ ...details, observedAt: previous?.sources.find((source) => source.id === details.id)?.observedAt ?? null, status: 'unavailable', note: '' }));
  const source = (id) => sources.find((entry) => entry.id === id);
  const results = await Promise.allSettled([fetchSource(CATALOG_URL, transport), fetchSource(RANKINGS_URL, transport), fetchSource(TERMINAL_BENCH_URL, transport)]);
  let payload = null;
  let models;
  try {
    if (results[0].status === 'rejected') throw results[0].reason;
    payload = results[0].value;
    models = parseCatalog(payload);
    Object.assign(source('openrouter-catalog'), { status: 'ok', observedAt: fetchedAt, note: `${models.length} text-output OpenRouter entries, including aliases and variants; not the whole market. Base prices are USD per million tokens; provider and context-tier prices can differ.` });
  } catch (error) {
    payload = null;
    if (!previous?.models?.length) throw new Error(`No usable catalog or previous snapshot: ${error.message}`);
    models = structuredClone(previous.models);
    source('openrouter-catalog').note = `Catalog refresh failed; retained the last successful catalog. ${error.message}`;
  }

  if (payload && models.some((model) => BENCHMARK_FIELDS.some((field) => model[field] !== null))) {
    Object.assign(source('artificial-analysis'), { status: 'ok', observedAt: fetchedAt, note: 'Artificial Analysis intelligence, coding, and agentic indices as forwarded by OpenRouter. Original scales, not percentages or a DADES aggregate. Missing evaluations remain null.' });
  } else {
    keepFields(models, previous, BENCHMARK_FIELDS);
    source('artificial-analysis').note = 'The refreshed catalog did not supply usable benchmark indices. Last successful observations, if any, are retained at their earlier timestamp.';
  }

  try {
    if (results[1].status === 'rejected') throw results[1].reason;
    const rankings = parseRankings(results[1].value, payload);
    for (const model of models) {
      const usage = rankings.byId.get(model.id);
      Object.assign(model, usage ?? { tokens7d: null, previousTokens7d: null, dailyTokens: [] });
    }
    Object.assign(source('openrouter-usage'), { status: 'ok', observedAt: rankings.observedAt, note: rankings.note });
  } catch (error) {
    keepFields(models, previous, USAGE_FIELDS);
    source('openrouter-usage').note = `Published usage could not be refreshed; last successful observations, if any, are retained. No history is estimated. ${error.message}`;
  }

  let terminalBench = previous?.terminalBench ?? null;
  try {
    if (results[2].status === 'rejected') throw results[2].reason;
    const matched = matchTerminalBench(parseTerminalBench(results[2].value), models, aliases.terminalBench ?? {});
    for (const model of models) model.terminalBench = matched.byId.get(model.id) ?? null;
    terminalBench = { title: matched.title, url: matched.url, updatedAt: matched.updatedAt, rows: matched.rows };
    Object.assign(source('terminal-bench'), { status: 'ok', observedAt: matched.updatedAt, note: `${matched.mapped}/${matched.rows.length} published Terminal-Bench 4.0 rows map to catalog models; each model keeps its best accuracy across agents and reasoning efforts, and unmapped rows stay in the board list only. Results depend on the agent harness. Leaderboard updated ${matched.updatedAt.slice(0, 10)} UTC.` });
  } catch (error) {
    keepFields(models, previous, TERMINAL_BENCH_FIELDS);
    source('terminal-bench').note = `Terminal-Bench leaderboard could not be refreshed; retained the last successful observations, if any. ${error.message}`;
  }

  try {
    if (!payload) throw new Error('Current catalog is unavailable, so model page sampling was skipped.');
    const sample = performanceSample(models);
    const observations = await collectPerformance(sample, transport);
    const measured = [...observations.values()].filter((observation) => observation.speed !== null).length;
    if (!measured) throw new Error(`No provider throughput was published for the ${sample.length} sampled model pages.`);
    for (const model of models) Object.assign(model, observations.get(model.id) ?? EMPTY_PERFORMANCE);
    Object.assign(source('openrouter-performance'), { status: 'ok', observedAt: fetchedAt, note: `${measured}/${sample.length} sampled models publish provider p50 statistics on their OpenRouter pages. Sample combines leading intelligence and usage models. Each value is the p50 output tokens/second and p50 latency of the standard endpoint with the most requests in the published window, not a provider average.` });
  } catch (error) {
    keepFields(models, previous, PERFORMANCE_FIELDS);
    source('openrouter-performance').note = `Performance p50 unavailable; retained last successful observations, if any, at their earlier timestamp. ${error.message}`;
  }

  return { schemaVersion: SCHEMA_VERSION, fetchedAt, sources, terminalBench, models };
}
```

- [ ] **Step 5: `catalog.mjs`에서 `endpointRequests`·`parseEndpoint` 삭제**

`scripts/status/catalog.mjs`의 `export function endpointRequests(payload, selectedModels) { ... }`와 `export function parseEndpoint(payload, request) { ... }` 두 함수를 통째로 지운다. 파일 끝은 `parseCatalog`의 닫는 중괄호가 된다.

- [ ] **Step 6: `scripts/status/cli.mjs` 전체 교체**

```js
#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSnapshot, upgradeSnapshot } from './refresh.mjs';

const outputPath = fileURLToPath(new URL('../../public/data/model-board.json', import.meta.url));
const aliasPath = fileURLToPath(new URL('../../config/status.aliases.json', import.meta.url));

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/status/cli.mjs\nRefresh public/data/model-board.json from public OpenRouter and Terminal-Bench pages. No API key is required.');
    return;
  }
  if (args.length) throw new Error(`Unknown argument: ${args[0]}`);
  const existing = await readJson(outputPath);
  const previous = existing ? upgradeSnapshot(existing) : null;
  const aliases = (await readJson(aliasPath)) ?? {};
  const snapshot = await refreshSnapshot({ previous, aliases });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, outputPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
  console.log(JSON.stringify({
    fetchedAt: snapshot.fetchedAt, models: snapshot.models.length,
    terminalBenchRows: snapshot.terminalBench?.rows.length ?? 0, measuredSpeed: snapshot.models.filter((model) => model.speed !== null).length,
    sources: snapshot.sources.map(({ id, status, observedAt, note }) => ({ id, status, observedAt, note })),
  }, null, 2));
}

main().catch((error) => {
  console.error(`Status refresh failed: ${error.message}`);
  process.exitCode = 1;
});
```

- [ ] **Step 7: 별칭 파일 생성**

`config/status.aliases.json`:

```json
{
  "terminalBench": {}
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `node --test tests/status-data.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 55`, `# fail 0`.

- [ ] **Step 9: 커밋**

```bash
git add scripts/status/refresh.mjs scripts/status/cli.mjs scripts/status/catalog.mjs config/status.aliases.json tests/status-data.test.mjs
git commit -m "상태판 스냅샷 v2 — Terminal-Bench·모델 페이지 속도 통합, v1 자동 이전, 별칭 파일

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 실제 갱신 실행, 스냅샷·문서 갱신

**Files:**
- Modify: `public/data/model-board.json` (갱신 결과)
- Modify: `config/status.aliases.json` (미매핑 행이 있을 때만)
- Modify: `docs/status-data.md`, `docs/status-research.md`

**Interfaces:**
- Consumes: Task 4 `cli.mjs`.
- Produces: 이후 UI 작업이 빌드에 쓰는 v2 스냅샷. `terminalBench.rows`가 18행 안팎, 매핑 18/18, `measuredSpeed` ≥ 20이어야 한다.

- [ ] **Step 1: 갱신 실행**

Run: `node scripts/status/cli.mjs 2>&1 | tee /tmp/status-refresh.log | head -60`
Expected: 다섯 출처 모두 `"status": "ok"`. `terminal-bench` note가 `18/18 published`(오늘 리더보드 기준; 행 수는 바뀔 수 있다). `measuredSpeed`가 20 이상. `openrouter-performance` note가 `N/32 sampled models publish provider p50`.

미매핑이 있으면(`k/n published`에서 k < n): `node -e 'const b=require("./public/data/model-board.json");for(const r of b.terminalBench.rows) if(!r.modelId) console.log(r.model,"|",r.modelOrg)'`로 라벨을 보고, OpenRouter ID를 `config/status.aliases.json`의 `terminalBench`에 `"라벨": "author/slug"`로 추가한 뒤 갱신을 다시 실행한다.

- [ ] **Step 2: 스냅샷 검증**

```bash
node -e '
const b = require("./public/data/model-board.json");
console.log("schema", b.schemaVersion, "models", b.models.length, "tb rows", b.terminalBench.rows.length);
const canon = b.models.filter((m) => !m.id.includes(":") && !m.id.startsWith("~"));
console.log("with terminalBench", canon.filter((m) => m.terminalBench).length, "with speed", canon.filter((m) => m.speed !== null).length);
for (const m of canon.filter((m) => m.speed !== null).sort((a, b) => b.speed - a.speed).slice(0, 5)) console.log(m.id, m.speed, "tok/s", m.speedProvider, m.speedRequests, "req /", m.speedWindow, "min");
'
```
Expected: `schema 2`, `with terminalBench` ≥ 10, `with speed` ≥ 20, 상위 속도 목록에 제공사명·요청 수·창 길이가 모두 채워짐.

- [ ] **Step 3: 단위 테스트 재확인**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 55`(status) + 기존 editorial 테스트 수, `# fail 0`.

- [ ] **Step 4: `docs/status-data.md` 갱신**

Scope 표에서 `speed`·`latency` 행을 아래로 바꾸고 세 행을 추가한다.

```markdown
| `speed` | p50 output tokens per second of the standard OpenRouter provider endpoint that served the most requests in the published window |
| `latency` | p50 latency in seconds from the same endpoint (the page publishes milliseconds) |
| `speedRequests`, `speedWindow` | Request count and window length in minutes behind that endpoint's p50 |
| `terminalBench` | Best Terminal-Bench 4.0 accuracy mapped to the model: `{ accuracy, ci95, agent, effort, date }`, or null |
```

"Performance collection follows only endpoint detail URLs…"로 시작하는 문단 전체를 아래로 교체한다.

```markdown
Performance collection reads the public OpenRouter model page (`https://openrouter.ai/{author}/{slug}`) for up to 32 canonical models per refresh: 16 leading intelligence models, 16 leading usage models, then deterministic fill. Aliases and colon-suffixed variants are never sampled. The page embeds a `providerTableEndpointStats` query for the standard variant; each endpoint carries `p50_throughput`, `p50_latency`, `throughput_request_count`, and `window_minutes`. Free, deranked, disabled, hidden, and BYOK-only endpoints are ignored, as are endpoints with no requests or no throughput. The endpoint with the most requests wins; ties go to higher throughput, then provider slug. Requests run four at a time with a 15-second timeout and one retry each. If any sampled page still fails, the whole batch is discarded and the previous batch is retained so that measurements never mix timestamps. The documented `/api/v1/models/{id}/endpoints` route publishes these fields only to authenticated callers, which is why the page is used instead.
```

"Usage is taken from…" 문단 앞에 새 문단을 추가한다.

```markdown
Terminal-Bench 4.0 is read from the official leaderboard page (`https://www.tbench.ai/leaderboard/terminal-bench/4.0`), which embeds the leaderboard rows in its Next.js payload. The adapter requires the leaderboard name `4-0-0`, a non-empty row list, and an update time; each row needs a rank, model label, agent label, ISO date, and accuracy between 0 and 100. Rows are agent-plus-model combinations. Each row is mapped to a canonical OpenRouter model by normalising the label (lowercase alphanumerics) and matching it exactly or as a suffix of the catalog display name inside the organisation's namespace; ambiguous or unmatched labels fall back to `config/status.aliases.json`. A model keeps its best mapped accuracy with the agent, reasoning effort, 95% CI half-width, and run date. All rows, including unmapped ones, are stored in `terminalBench.rows` for the board panel. SWE-bench Verified is not collected: the official leaderboard stopped receiving frontier entries in February 2026 and Epoch AI's own runs end in June 2026, so neither covers current models.
```

"The live snapshot generated on 2026-09-07 contains…"로 시작하는 두 문장을 Step 1 로그의 실제 수치로 바꾼다. 형식:

```markdown
The live snapshot generated on 2026-09-09 contains N catalog entries, I intelligence observations, T weekly usage totals, R Terminal-Bench rows (M mapped), and S sampled models with provider throughput.
```

Refresh 절의 명령 목록 아래에 한 문장 추가: `Terminal-Bench label aliases live in config/status.aliases.json; the refresh reads it when present.`

Schema 절 첫 문장을 아래로 교체:

```markdown
The JSON has `schemaVersion: 2`, `fetchedAt`, `sources`, `terminalBench`, and `models`. `terminalBench` is `{ title, url, updatedAt, rows }` or null; each row is `{ rank, model, modelUrl, agent, agentOrg, modelOrg, effort, accuracy, ci95, date, trials, modelId }`. A version 1 file is upgraded in memory on the next refresh by adding null `terminalBench`, `speedRequests`, and `speedWindow` fields.
```

- [ ] **Step 5: `docs/status-research.md` 갱신**

참고 표 아래에 절을 추가한다.

```markdown
## 2026-09-08 추가 조사: 벤치마크·속도 출처

| 출처 | 확인 결과 | 결정 |
| --- | --- | --- |
| [Terminal-Bench 4.0 공식 리더보드](https://www.tbench.ai/leaderboard/terminal-bench/4.0) | 2026-09-03 갱신, 18행, 95% CI 포함, GPT-6 Astra·Fable 5.1·Opus 5·GLM-5.3 등 포함. 페이지 임베디드 JSON | 수집. 모델 값은 조합 중 최고 하나, 조합 전체는 패널에 표시 |
| [SWE-bench Verified 공식](https://www.swebench.com/) | 마지막 갱신 2026-02 | 싣지 않음 |
| [Epoch AI Benchmarking Hub](https://epoch.ai/benchmarks) (CC BY, 매일 ZIP) | SWE-bench Verified 자체 실행은 2026-06이 마지막. 다른 벤치마크는 9월 모델 반영 | SWE-bench 대체 출처로 부적합. 향후 다른 지표 후보 |
| [OpenRouter 문서화 endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model) | 인증 없이는 `throughput_last_30m`·`latency_last_30m`가 null | 사용 중단 |
| OpenRouter 공개 모델 페이지 | 제공사별 p50 속도·지연·요청 수·창 길이가 키 없이 임베디드됨 | 속도 출처로 채택. 요청 수 최다 표준 경로를 대표값으로 |
| Artificial Analysis, llm-stats, BenchLM, LLMPerf, TheFastest.ai | 약관 제한, 원본 비공개, 2026-01 아카이브, 사이트 폐쇄 | 사용 안 함 |
```

"실제 구현" 목록 5번(속도)을 아래로 교체한다.

```markdown
5. 속도는 OpenRouter 공개 모델 페이지의 제공사별 p50 중 요청 수가 가장 많은 표준 경로 하나를 쓰고, 제공사명·요청 수·창 길이를 함께 저장한다. 관측이 없는 모델은 0이 아니라 비워 둔다.
```

- [ ] **Step 6: 커밋**

```bash
git add public/data/model-board.json config/status.aliases.json docs/status-data.md docs/status-research.md
git commit -m "상태판 스냅샷 v2 첫 갱신 — Terminal-Bench 4.0 18행, 모델 페이지 속도 관측, 데이터 문서 갱신

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 화면 규칙 모듈 (순수 JS) + 타입 선언 + 테스트

**Files:**
- Create: `src/lib/model-board-rules.mjs`
- Create: `src/lib/model-board-rules.d.mts`
- Test: `tests/model-board-rules.test.mjs` (신설)
- Modify: `package.json` (`test` 스크립트에 새 테스트 추가)

**Interfaces:**
- Produces (모두 순수 함수, 입력은 스냅샷 모델 객체 배열):
  - `AXES = ['intelligence','coding','agentic']`, `METRICS = ['intelligence','coding','agentic','terminalBench','speed','cost','tokens7d']`, `ASCENDING = Set(['cost'])`, `VALUE_FLOOR = 0.8`, `TOP_STRENGTH = 3`
  - `baseId(id)`, `isCanonicalId(id)`
  - `metricValue(model, metric): number | null` — `terminalBench`는 `model.terminalBench.accuracy`, `cost`는 `inputPrice + outputPrice`
  - `rankBy(models, metric)` — 값 있는 모델만, `cost`는 오름차순, 동률은 이름순
  - `canonicalModels(models)` — 변형 접기, 각 항목에 `variants: [{ id, kind, inputPrice, outputPrice }]`
  - `variantChip(primary, variant): string`
  - `paretoFrontier(models)`, `valueSet(models)`, `valuePick(models)`
  - `strengthMap(models): Map<id, ('종합'|'코딩'|'에이전트'|'빠름'|'가성비')[]>`
  - `axisMaxima(models): { intelligence, coding, agentic }`, `fingerprint(model, maxima): [{ axis, value, ratio }]`

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/model-board-rules.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { axisMaxima, canonicalModels, fingerprint, metricValue, paretoFrontier, rankBy, strengthMap, valuePick, valueSet, variantChip } from '../src/lib/model-board-rules.mjs';

const model = (id, overrides = {}) => ({
  id, name: id.split('/')[1], provider: id.split('/')[0], url: `https://openrouter.ai/${id}`, context: 1000, inputPrice: 1, outputPrice: 4,
  intelligence: null, coding: null, agentic: null, speed: null, latency: null, speedProvider: null, speedRequests: null, speedWindow: null,
  terminalBench: null, tokens7d: null, previousTokens7d: null, dailyTokens: [], ...overrides,
});

const fleet = [
  model('a/leader', { intelligence: 50, coding: 80, agentic: 55, inputPrice: 10, outputPrice: 50, speed: 60, terminalBench: { accuracy: 58, ci95: 3, agent: 'Codex', effort: 'max', date: '2026-09-03' } }),
  model('b/runner', { intelligence: 45, coding: 70, agentic: 50, inputPrice: 2, outputPrice: 8, speed: 90 }),
  model('c/cheap', { intelligence: 41, coding: 60, agentic: 40, inputPrice: 0.1, outputPrice: 0.3, speed: 120 }),
  model('d/dominated', { intelligence: 44, coding: 65, agentic: 45, inputPrice: 3, outputPrice: 9, speed: 30 }),
  model('e/weak', { intelligence: 20, coding: 30, agentic: 10, inputPrice: 0, outputPrice: 0, speed: 200 }),
  model('f/blank', { inputPrice: null, outputPrice: null }),
];

test('metric values read nested Terminal-Bench accuracy and derived 1M+1M cost, leaving unknowns null', () => {
  assert.equal(metricValue(fleet[0], 'terminalBench'), 58);
  assert.equal(metricValue(fleet[1], 'terminalBench'), null);
  assert.equal(metricValue(fleet[0], 'cost'), 60);
  assert.equal(metricValue(model('x/y', { inputPrice: null }), 'cost'), null);
  assert.equal(metricValue(fleet[5], 'intelligence'), null);
});

test('ranking sorts cost ascending, everything else descending, and drops models without a value', () => {
  assert.deepEqual(rankBy(fleet, 'cost').map((m) => m.id), ['e/weak', 'c/cheap', 'b/runner', 'd/dominated', 'a/leader']);
  assert.deepEqual(rankBy(fleet, 'speed').slice(0, 2).map((m) => m.id), ['e/weak', 'c/cheap']);
  assert.deepEqual(rankBy(fleet, 'terminalBench').map((m) => m.id), ['a/leader']);
  assert.deepEqual(rankBy(fleet, 'tokens7d'), []);
});

test('canonical folding keeps the base model as the row and lists alias, batch, and free variants as chips', () => {
  const folded = canonicalModels([model('x/base', { outputPrice: 10 }), model('x/base:batch', { outputPrice: 5 }), model('x/base:free', { inputPrice: 0, outputPrice: 0 }), model('~x/base'), model('y/only:free', { outputPrice: 0 })]);
  assert.deepEqual(folded.map((m) => m.id), ['x/base', 'y/only:free']);
  assert.deepEqual(folded[0].variants.map((v) => v.kind), ['alias', 'batch', 'free']);
  assert.deepEqual(folded[0].variants.map((v) => variantChip(folded[0], v)), ['alias', 'batch −50%', 'free']);
  assert.deepEqual(folded[1].variants, []);
});

test('the Pareto frontier keeps models nothing beats on both score and cost, and value picks the cheapest strong one', () => {
  assert.deepEqual(paretoFrontier(fleet).map((m) => m.id), ['e/weak', 'c/cheap', 'b/runner', 'a/leader']);
  assert.deepEqual(valueSet(fleet).map((m) => m.id), ['c/cheap', 'b/runner']);
  assert.equal(valuePick(fleet).id, 'c/cheap');
  assert.equal(valuePick([model('z/none')]), null);
});

test('strength labels mark the top three per axis, the top three fastest, and the value set in a fixed order', () => {
  const labels = strengthMap(fleet);
  assert.deepEqual(labels.get('a/leader'), ['종합', '코딩', '에이전트']);
  assert.deepEqual(labels.get('b/runner'), ['종합', '코딩', '에이전트', '빠름', '가성비']);
  assert.deepEqual(labels.get('c/cheap'), ['빠름', '가성비']);
  assert.deepEqual(labels.get('e/weak'), ['빠름']);
  assert.equal(labels.get('f/blank'), undefined);
});

test('fingerprints scale each axis to the fleet maximum and mark missing axes instead of drawing zero', () => {
  const maxima = axisMaxima(fleet);
  assert.deepEqual(maxima, { intelligence: 50, coding: 80, agentic: 55 });
  assert.deepEqual(fingerprint(fleet[1], maxima).map((bar) => bar.ratio), [0.9, 0.875, 50 / 55]);
  assert.deepEqual(fingerprint(fleet[5], maxima).map((bar) => bar.ratio), [null, null, null]);
  assert.deepEqual(fingerprint(fleet[5], maxima).map((bar) => bar.axis), ['intelligence', 'coding', 'agentic']);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/model-board-rules.test.mjs 2>&1 | tail -3`
Expected: `Cannot find module '.../src/lib/model-board-rules.mjs'`.

- [ ] **Step 3: `src/lib/model-board-rules.mjs` 작성**

```js
// Pure ranking and labelling rules for the status board. No DOM, no zod; shared by Astro, the browser, and Node tests.
export const AXES = Object.freeze(['intelligence', 'coding', 'agentic']);
export const METRICS = Object.freeze(['intelligence', 'coding', 'agentic', 'terminalBench', 'speed', 'cost', 'tokens7d']);
export const ASCENDING = new Set(['cost']);
export const VALUE_FLOOR = 0.8;
export const TOP_STRENGTH = 3;

export const baseId = (id) => id.replace(/^~/, '').replace(/:.*$/, '');
export const isCanonicalId = (id) => !id.startsWith('~') && !id.includes(':');

export function metricValue(model, metric) {
  if (metric === 'terminalBench') return model.terminalBench?.accuracy ?? null;
  if (metric === 'cost') return model.inputPrice === null || model.outputPrice === null ? null : model.inputPrice + model.outputPrice;
  return model[metric] ?? null;
}

export function rankBy(models, metric) {
  return models.filter((model) => metricValue(model, metric) !== null).sort((a, b) => {
    const av = metricValue(a, metric);
    const bv = metricValue(b, metric);
    return (ASCENDING.has(metric) ? av - bv : bv - av) || a.name.localeCompare(b.name);
  });
}

export function canonicalModels(models) {
  const groups = new Map();
  for (const model of models) {
    const base = baseId(model.id);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(model);
  }
  return [...groups].map(([base, group]) => {
    const primary = group.find((model) => model.id === base) ?? [...group].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id))[0];
    const variants = group.filter((model) => model !== primary)
      .map((model) => ({ id: model.id, kind: model.id.includes(':') ? model.id.slice(model.id.indexOf(':') + 1) : 'alias', inputPrice: model.inputPrice, outputPrice: model.outputPrice }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
    return { ...primary, variants };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function variantChip(primary, variant) {
  if (variant.kind === 'batch' && primary.outputPrice && variant.outputPrice !== null && variant.outputPrice < primary.outputPrice) {
    return `batch −${Math.round((1 - variant.outputPrice / primary.outputPrice) * 100)}%`;
  }
  return variant.kind;
}

export function paretoFrontier(models) {
  const cost = (model) => metricValue(model, 'cost');
  const candidates = models.filter((model) => model.intelligence !== null && cost(model) !== null);
  return candidates
    .filter((model) => !candidates.some((other) => other !== model && ((other.intelligence > model.intelligence && cost(other) <= cost(model)) || (other.intelligence >= model.intelligence && cost(other) < cost(model)))))
    .sort((a, b) => cost(a) - cost(b) || b.intelligence - a.intelligence);
}

export function valueSet(models) {
  const leader = rankBy(models, 'intelligence')[0];
  if (!leader) return [];
  return paretoFrontier(models).filter((model) => model.id !== leader.id && model.intelligence >= leader.intelligence * VALUE_FLOOR);
}

export function valuePick(models) {
  return valueSet(models)[0] ?? null;
}

export function strengthMap(models) {
  const map = new Map();
  const add = (model, label) => map.set(model.id, [...(map.get(model.id) ?? []), label]);
  for (const [metric, label] of [['intelligence', '종합'], ['coding', '코딩'], ['agentic', '에이전트'], ['speed', '빠름']]) {
    for (const model of rankBy(models, metric).slice(0, TOP_STRENGTH)) add(model, label);
  }
  for (const model of valueSet(models)) add(model, '가성비');
  return map;
}

export function axisMaxima(models) {
  return Object.fromEntries(AXES.map((axis) => [axis, Math.max(0, ...models.map((model) => model[axis] ?? 0))]));
}

export function fingerprint(model, maxima) {
  return AXES.map((axis) => {
    const value = model[axis] ?? null;
    return { axis, value, ratio: value === null || !maxima[axis] ? null : value / maxima[axis] };
  });
}
```

- [ ] **Step 4: `src/lib/model-board-rules.d.mts` 작성**

```ts
import type { Model } from './model-board';

export type Axis = 'intelligence' | 'coding' | 'agentic';
export type Metric = Axis | 'terminalBench' | 'speed' | 'cost' | 'tokens7d';
export type Strength = '종합' | '코딩' | '에이전트' | '빠름' | '가성비';
export interface Variant { id: string; kind: string; inputPrice: number | null; outputPrice: number | null }
export type CanonicalModel = Model & { variants: Variant[] };
export interface FingerprintBar { axis: Axis; value: number | null; ratio: number | null }

export const AXES: readonly Axis[];
export const METRICS: readonly Metric[];
export const ASCENDING: ReadonlySet<Metric>;
export const VALUE_FLOOR: number;
export const TOP_STRENGTH: number;
export function baseId(id: string): string;
export function isCanonicalId(id: string): boolean;
export function metricValue(model: Model, metric: Metric): number | null;
export function rankBy<T extends Model>(models: readonly T[], metric: Metric): T[];
export function canonicalModels(models: readonly Model[]): CanonicalModel[];
export function variantChip(primary: Model, variant: Variant): string;
export function paretoFrontier<T extends Model>(models: readonly T[]): T[];
export function valueSet<T extends Model>(models: readonly T[]): T[];
export function valuePick<T extends Model>(models: readonly T[]): T | null;
export function strengthMap(models: readonly Model[]): Map<string, Strength[]>;
export function axisMaxima(models: readonly Model[]): Record<Axis, number>;
export function fingerprint(model: Model, maxima: Record<Axis, number>): FingerprintBar[];
```

- [ ] **Step 5: `package.json`의 test 스크립트에 추가**

`"test": "node --test tests/editorial.test.mjs tests/editorial-cover.test.mjs tests/status-data.test.mjs tests/model-board-rules.test.mjs",`
`"test:status": "node --test tests/status-data.test.mjs tests/model-board-rules.test.mjs"`

- [ ] **Step 6: 테스트 통과 확인**

Run: `node --test tests/model-board-rules.test.mjs 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/model-board-rules.mjs src/lib/model-board-rules.d.mts tests/model-board-rules.test.mjs package.json
git commit -m "상태판 화면 규칙 모듈 — 변형 접기, Pareto 가성비, 강점 라벨, 지문 스케일

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `model-board.ts` 스키마 v2와 축 유틸

**Files:**
- Modify: `src/lib/model-board.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 6 규칙 모듈.
- Produces (다른 TS/Astro 파일이 import하는 이름): `boardSchema`, `ModelBoard`, `Model`, `TerminalBenchRow`, `Metric`, `Axis`, `Strength`, `CanonicalModel`, `Variant`, `metrics`, `metricKeys`, `axisKeys`, `cardMetrics`, `isMetric`, `isAxis`, `modelName`, `EMPTY`, `amount`, `dollars`, `compact`, `percent`, `metricValue`(문자열), `metricNumber`(숫자), `ranked`, `canonicalModels`, `variantChip`, `valueSet`, `valuePick`, `strengthMap`, `axisMaxima`, `fingerprint`, `estimate`, `tokenChange`, `observedAt`, `scatter(models, axis?)`, `providerTone`, `sourceCopy`, `sourceForMetric`, `leaderNote`, `valueNote`, `terminalRows`, `terminalUpdated`.
- 이 태스크 뒤 기존 `.astro`·클라이언트 TS는 여전히 컴파일된다(`tsc`). 화면 변경은 Task 8·9.

- [ ] **Step 1: 파일 전체 교체 — `src/lib/model-board.ts`**

```ts
import { z } from 'astro/zod';
import { AXES, METRICS, rankBy, valueSet, metricValue as metricNumber, type Axis, type Metric } from './model-board-rules.mjs';

export type { Axis, CanonicalModel, Metric, Strength, Variant } from './model-board-rules.mjs';
export { axisMaxima, canonicalModels, fingerprint, metricValue as metricNumber, paretoFrontier, rankBy as ranked, strengthMap, valuePick, valueSet, variantChip } from './model-board-rules.mjs';

const https = z.string().url().refine((url) => new URL(url).protocol === 'https:');
const number = z.number().finite().nonnegative().nullable();
const percentage = z.number().min(0).max(100);
export const boardSchema = z.object({
  schemaVersion: z.literal(2),
  fetchedAt: z.string().datetime(),
  sources: z.array(z.object({
    id: z.string(), label: z.string(), url: https,
    observedAt: z.string().datetime().nullable(), status: z.enum(['ok', 'unavailable']), note: z.string(),
  })),
  terminalBench: z.object({
    title: z.string(), url: https, updatedAt: z.string().datetime(),
    rows: z.array(z.object({
      rank: z.number().int().positive(), model: z.string(), modelUrl: https.nullable(), agent: z.string(), agentOrg: z.string().nullable(), modelOrg: z.string().nullable(),
      effort: z.string().nullable(), accuracy: percentage, ci95: number, date: z.string(), trials: number, modelId: z.string().nullable(),
    })),
  }).nullable(),
  models: z.array(z.object({
    id: z.string(), name: z.string(), provider: z.string(), url: https,
    context: number, inputPrice: number, outputPrice: number,
    intelligence: number, coding: number, agentic: number,
    speed: number, latency: number, speedProvider: z.string().nullable(), speedRequests: number, speedWindow: number,
    terminalBench: z.object({ accuracy: percentage, ci95: number, agent: z.string(), effort: z.string().nullable(), date: z.string() }).nullable(),
    tokens7d: number, previousTokens7d: number,
    dailyTokens: z.array(z.object({ date: z.string(), tokens: z.number().finite().nonnegative() })),
  })),
});
export type ModelBoard = z.infer<typeof boardSchema>;
export type Model = ModelBoard['models'][number];
export type TerminalBenchRow = NonNullable<ModelBoard['terminalBench']>['rows'][number];

export const metrics: Record<Metric, { label: string; unit: string; title: string; ascending: boolean }> = {
  intelligence: { label: '종합', unit: 'AA', title: '종합 1위', ascending: false },
  coding: { label: '코딩', unit: 'AA', title: '코딩 1위', ascending: false },
  agentic: { label: '에이전트', unit: 'AA', title: '에이전트 1위', ascending: false },
  terminalBench: { label: 'TB 4.0', unit: '%', title: 'Terminal-Bench 1위', ascending: false },
  speed: { label: '속도', unit: 'tok/s', title: '속도 1위', ascending: false },
  cost: { label: '비용', unit: '$ / 1M+1M', title: '가성비', ascending: true },
  tokens7d: { label: '사용량', unit: 'tokens', title: '사용량 1위', ascending: false },
};
export const metricKeys: readonly Metric[] = METRICS;
export const axisKeys: readonly Axis[] = AXES;
export const cardMetrics = ['intelligence', 'coding', 'agentic', 'speed'] as const;
export const isMetric = (value: string | null): value is Metric => metricKeys.some((key) => key === value);
export const isAxis = (value: string | null): value is Axis => axisKeys.some((key) => key === value);
export const modelName = (model: Pick<Model, 'name'>) => model.name.replace(/^[^:]+:\s*/, '');
export const EMPTY = '–';
export const amount = (value: number | null, digits = 1) => value === null ? EMPTY : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
export const dollars = (value: number | null) => value === null ? EMPTY : `$${amount(value, value > 0 && value < 0.1 ? 4 : 2)}`;
export const compact = (value: number | null) => value === null ? EMPTY : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const percent = (value: number | null) => value === null ? EMPTY : `${amount(value, 1)}%`;
export function metricValue(model: Model, metric: Metric) {
  switch (metric) {
    case 'intelligence': case 'coding': case 'agentic': return amount(model[metric]);
    case 'terminalBench': return percent(metricNumber(model, metric));
    case 'speed': return amount(model.speed, 0);
    case 'cost': return dollars(metricNumber(model, metric));
    case 'tokens7d': return compact(model.tokens7d);
  }
}
export function estimate(model: Model, input: number, output: number) {
  return model.inputPrice === null || model.outputPrice === null ? null : model.inputPrice * input + model.outputPrice * output;
}
export function tokenChange(model: Model) {
  return model.tokens7d === null || !model.previousTokens7d ? null : (model.tokens7d / model.previousTokens7d - 1) * 100;
}
export function observedAt(board: ModelBoard) {
  const date = new Date(board.fetchedAt);
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(date);
}
export function scatter(models: readonly Model[], axis: Axis = 'intelligence') {
  const cost = (model: Model) => estimate(model, 1, 1) ?? 0;
  const candidates = rankBy(models, axis).filter((model) => estimate(model, 1, 1) !== null);
  const leader = candidates[0];
  const frontier = axis === 'intelligence' && leader ? [...valueSet(models).filter((model) => estimate(model, 1, 1) !== null), leader].sort((a, b) => cost(a) - cost(b)) : [];
  const chosen = [...new Map([...candidates.slice(0, 14), ...[...candidates].sort((a, b) => cost(a) - cost(b)).slice(0, 6), ...frontier].map((model) => [model.id, model])).values()];
  const maxCost = Math.max(10, ...chosen.map(cost));
  const maxScore = Math.max(20, Math.ceil(Math.max(...chosen.map((model) => model[axis] ?? 0), 0) / 10) * 10);
  const x = (value: number) => 55 + Math.log10(1 + value) / Math.log10(1 + maxCost) * 550;
  const y = (score: number) => 260 - score / maxScore * 220;
  const frontierPoints = frontier.flatMap((model, index) => {
    const px = x(cost(model));
    const py = y(model.intelligence ?? 0);
    const previous = frontier[index - 1];
    return previous ? [`${px},${y(previous.intelligence ?? 0)}`, `${px},${py}`] : [`${px},${py}`];
  }).join(' ');
  return { axis, models: chosen, x, y, maxScore, ticks: [0, 1, 5, 10, 25, 50, 100, 250].filter((tick) => tick <= maxCost), frontier, frontierPoints };
}
export function providerTone(name: string) {
  const provider = name.toLowerCase();
  if (provider === 'openai') return 'blue';
  if (provider === 'anthropic') return 'orange';
  if (provider === 'google') return 'green';
  return 'slate';
}

export function sourceCopy(source: ModelBoard['sources'][number]) {
  const retained = source.status !== 'ok' && source.observedAt ? ' 이전 관측값을 유지하고 있습니다.' : '';
  switch (source.id) {
    case 'openrouter-catalog': return '텍스트 출력 모델의 기본 단가와 컨텍스트입니다. 별칭·무료·배치 경로가 포함되며, 제공 경로와 입력 길이에 따라 가격이 달라질 수 있습니다.' + retained;
    case 'artificial-analysis': return 'OpenRouter가 전달하는 AA 종합·코딩·에이전트 지수를 원래 단위로 표시합니다. 확인 시각은 벤치마크 실행일과 다릅니다.' + retained;
    case 'terminal-bench': return 'tbench.ai 공식 4.0 리더보드의 에이전트+모델 조합 결과입니다. 모델 값은 조합 중 최고 정확도 하나이며 에이전트명을 함께 둡니다.' + retained;
    case 'openrouter-performance': return '종합·사용량 상위 최대 32개 모델의 OpenRouter 페이지에서 요청 수가 가장 많은 표준 경로의 최근 p50 속도·지연입니다. 미제공은 0이 아닙니다.' + retained;
    case 'openrouter-usage': return '공개 주간 순위의 입력+출력 토큰 합계입니다. 집계 기간은 아래 UTC 기준일까지의 7일이며, 공개된 상위 모델만 포함합니다. 비공개·직접 API 사용량은 포함하지 않습니다.' + retained;
    default: return source.status === 'ok' ? '출처의 공개 관측값을 표시합니다.' : '현재 이 출처의 새 관측값을 확인하지 못했습니다.';
  }
}
const metricSources: Record<Metric, string> = { intelligence: 'artificial-analysis', coding: 'artificial-analysis', agentic: 'artificial-analysis', terminalBench: 'terminal-bench', speed: 'openrouter-performance', cost: 'openrouter-catalog', tokens7d: 'openrouter-usage' };
export function sourceForMetric(board: ModelBoard, metric: Metric) {
  const source = board.sources.find((entry) => entry.id === metricSources[metric]);
  if (!source?.observedAt) return '관측값 미제공';
  return (source.status === 'ok' ? '기준 ' : '이전 관측 ') + new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(source.observedAt)) + ' UTC';
}
export function leaderNote(board: ModelBoard, leader: Model | undefined, metric: Metric) {
  const stamp = sourceForMetric(board, metric);
  if (!leader) return stamp;
  const detail = metric === 'coding' && leader.terminalBench ? `Terminal-Bench 4.0 · ${percent(leader.terminalBench.accuracy)}` : metric === 'speed' && leader.speedProvider ? leader.speedProvider : leader.provider;
  return `${detail} · ${stamp}`;
}
export function valueNote(models: readonly Model[], pick: Model) {
  const leader = rankBy(models, 'intelligence')[0];
  const share = leader?.intelligence && pick.intelligence !== null ? Math.round(pick.intelligence / leader.intelligence * 100) : null;
  return share === null ? `종합 ${amount(pick.intelligence)}` : `종합 ${amount(pick.intelligence)} · 선두의 ${share}%`;
}
export function terminalRows(board: ModelBoard, limit = 6): TerminalBenchRow[] {
  const seen = new Set<string>();
  return (board.terminalBench?.rows ?? []).filter((row) => !seen.has(row.model) && Boolean(seen.add(row.model))).slice(0, limit);
}
export function terminalUpdated(board: ModelBoard) {
  return board.terminalBench ? `${new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(board.terminalBench.updatedAt))} UTC 갱신` : null;
}
```

- [ ] **Step 2: 타입 검사와 빌드**

Run: `npx tsc --noEmit -p tsconfig.json; echo "tsc exit $?"`
Expected: `tsc exit 0`. 오류가 `model-board-client.ts`의 `metricKeys`(카드 4개 순회) 등 기존 호출부에서 나면 그 파일은 Task 9에서 교체되므로, 오류 메시지가 `model-board.ts`·`model-board-rules.d.mts` 내부가 아닌 경우에만 진행한다.

Run: `npm run build 2>&1 | tail -3`
Expected: `Complete!` 포함(pagefind 색인까지). 스냅샷이 v2가 아니면 zod가 `schemaVersion` 오류를 내니 Task 5가 먼저 끝나야 한다.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/model-board.ts
git commit -m "상태판 보드 스키마 v2 — 7개 지표 축, 축 선택 산점도와 가성비 전선, 출처 문구

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 서버 렌더 — 컴포넌트·페이지·CSS

**Files:**
- Create: `src/components/status/Fingerprint.astro`, `src/components/status/TerminalBenchPanel.astro`
- Modify: `src/components/status/ModelRow.astro`, `src/components/status/BoardCharts.astro`, `src/pages/status.astro` (전체 교체)
- Modify: `src/styles/model-board.css`

**Interfaces:**
- Consumes: Task 7의 모든 export.
- Produces: 브라우저 렌더(Task 9)가 똑같이 만들어야 하는 DOM 구조. 훅: `[data-metric-shortcut]`, `[data-value-card]`, `[data-leader-value=…]`, `[data-leader-name=…]`, `[data-leader-note=…]`, `[data-leader-art=…]`, `[data-axis-head]`, `[data-column]`, `[data-axis-title]`, `[data-frontier]`, `[data-terminal-rows]`, `[data-terminal-empty]`, `[data-terminal-link]`, `.fingerprint > .fp-bar`, `.strength-pill`, `.variant-chip`, `.axis-value`.

- [ ] **Step 1: `src/components/status/Fingerprint.astro`**

```astro
---
import { amount, fingerprint, metrics, type Axis, type Metric, type Model } from '../../lib/model-board';
interface Props { readonly model: Model; readonly maxima: Record<Axis, number>; readonly metric: Metric; }
const { model, maxima, metric } = Astro.props;
const bars = fingerprint(model, maxima);
const summary = bars.map((bar) => `${metrics[bar.axis].label} ${amount(bar.value)}`).join(' · ');
---
<span class="fingerprint" role="img" aria-label={summary} title={summary}>{bars.map((bar) => <i class:list={['fp-bar', { 'fp-active': bar.axis === metric, 'fp-missing': bar.ratio === null }]} style={`--fp:${Math.round((bar.ratio ?? 0) * 100)}%`} />)}</span>
```

- [ ] **Step 2: `src/components/status/ModelRow.astro` 전체 교체**

```astro
---
import Fingerprint from './Fingerprint.astro';
import { amount, dollars, EMPTY, isAxis, metricValue, modelName, variantChip, type Axis, type CanonicalModel, type Metric, type Strength } from '../../lib/model-board';
interface Props { readonly model: CanonicalModel; readonly rank: number; readonly metric: Metric; readonly maxima: Record<Axis, number>; readonly strengths: readonly Strength[]; }
const { model, rank, metric, maxima, strengths } = Astro.props;
const tb = model.terminalBench;
const cell = (key: Metric) => ['numeric', { 'metric-active': metric === key, empty: metricValue(model, key) === EMPTY }];
---
<tr data-model-row={model.id}>
  <td class="board-rank">{rank}</td>
  <th scope="row"><div class="model-identity"><label class="compare-check" data-js-only hidden><input type="checkbox" data-compare={model.id} aria-label={`${modelName(model)} 비교`} /><span class="sr-only">비교</span></label><div><a href={model.url} target="_blank" rel="noopener noreferrer">{modelName(model)}<span class="sr-only"> 원문, 새 탭</span></a><small>{model.provider}{model.variants.map((variant) => <span class="variant-chip">{variantChip(model, variant)}</span>)}</small></div></div></th>
  <td class="fingerprint-cell"><Fingerprint model={model} maxima={maxima} metric={metric} /></td>
  <td class="strength-cell">{strengths.map((label) => <span class="strength-pill">{label}</span>)}</td>
  <td class:list={cell('terminalBench')} title={tb ? `±${amount(tb.ci95)} · ${tb.agent}${tb.effort ? ` · ${tb.effort}` : ''} · ${tb.date}` : undefined}><span>{metricValue(model, 'terminalBench')}</span></td>
  <td class:list={cell('speed')}><span>{metricValue(model, 'speed')}</span>{model.speedProvider && <small>{model.speedProvider}</small>}</td>
  <td class:list={cell('cost')} title={`입력 ${dollars(model.inputPrice)} · 출력 ${dollars(model.outputPrice)}`}><span>{metricValue(model, 'cost')}</span></td>
  <td class:list={cell('tokens7d')}><span>{metricValue(model, 'tokens7d')}</span></td>
  <td class:list={['numeric', 'axis-value', { 'metric-active': isAxis(metric) }]}><span>{isAxis(metric) ? metricValue(model, metric) : ''}</span></td>
</tr>
```

- [ ] **Step 3: `src/components/status/TerminalBenchPanel.astro`**

```astro
---
import GlassPanel from './GlassPanel.astro';
import { amount, terminalRows, terminalUpdated, type ModelBoard } from '../../lib/model-board';
interface Props { readonly board: ModelBoard; }
const { board } = Astro.props;
const rows = terminalRows(board);
const top = rows[0]?.accuracy || 1;
const updated = terminalUpdated(board);
---
<GlassPanel class="terminal-panel" label="Terminal-Bench 4.0 공식 순위">
  <div class="panel-heading"><div><h2>Terminal-Bench 4.0</h2></div></div>
  <p class="board-caption">모델별 최고 기록 · 에이전트 조합</p>
  <ol class="usage-bars terminal-rows" data-terminal-rows>
    {rows.map((row) => <li><div><span class="usage-rank">{row.rank}</span><span class="usage-name">{row.model}</span><strong>{amount(row.accuracy)}%</strong></div><small class="terminal-agent">{row.agent}{row.effort ? ` · ${row.effort}` : ''}</small><div class="usage-track"><span style={`width:${row.accuracy / top * 100}%`} /></div></li>)}
  </ol>
  <p class="board-empty" data-terminal-empty hidden={rows.length > 0}>공식 리더보드를 확인하지 못했습니다.</p>
  <a class="source-link" href={board.terminalBench?.url ?? 'https://www.tbench.ai/leaderboard/terminal-bench/4.0'} target="_blank" rel="noopener noreferrer" data-terminal-link>리더보드 원문{updated ? ` · ${updated}` : ''} ↗</a>
</GlassPanel>
```

- [ ] **Step 4: `src/components/status/BoardCharts.astro` 전체 교체**

```astro
---
import GlassPanel from './GlassPanel.astro';
import TerminalBenchPanel from './TerminalBenchPanel.astro';
import { amount, compact, dollars, estimate, metrics, modelName, providerTone, ranked, scatter, type Axis, type CanonicalModel, type Model, type ModelBoard } from '../../lib/model-board';
interface Props { readonly board: ModelBoard; readonly models: readonly CanonicalModel[]; readonly axis?: Axis; }
const { board, models, axis = 'intelligence' } = Astro.props;
const chart = scatter(models, axis);
const usage = ranked(board.models, 'tokens7d').slice(0, 5);
const readout = (model: Model) => `${modelName(model)} · ${metrics[axis].label} ${amount(model[axis])} · 기준 비용 ${dollars(estimate(model, 1, 1))}`;
const labelled = [chart.models[0], chart.frontier[0]].filter((model, index, list): model is Model => Boolean(model) && list.indexOf(model) === index);
const scoreTicks = [0, .25, .5, .75, 1].map((part) => chart.maxScore * part);
---
<div class="board-charts">
  <GlassPanel class="value-panel" label="성능과 비용 비교">
    <div class="panel-heading" id="value-chart"><div><h2>성능과 비용</h2></div><span class="chart-hint">왼쪽 위일수록 유리 ↖</span></div>
    <p class="board-caption">입력 1M + 출력 1M tokens · 점선은 가성비 전선</p>
    <div data-scatter>
      <svg class="scatter-chart" viewBox="0 0 640 310" role="img" aria-label="가로축 비용 USD, 세로축 AA 지수. 왼쪽 위일수록 적은 비용으로 높은 점수입니다.">
        {scoreTicks.map((score) => <g><line x1="55" x2="605" y1={chart.y(score)} y2={chart.y(score)} class="chart-grid" /><text x="42" y={chart.y(score) + 4} text-anchor="end">{amount(score, 0)}</text></g>)}
        {chart.ticks.map((tick) => <text x={chart.x(tick)} y="285" text-anchor="middle">${tick}</text>)}
        <text x="55" y="17" class="axis-title" data-axis-title>{metrics[axis].label} · AA 지수 ↑</text><text x="605" y="305" text-anchor="end">비용 USD · 로그 눈금 →</text>
        {chart.frontierPoints && <polyline class="frontier-line" points={chart.frontierPoints} data-frontier />}
        {chart.models.map((model) => <g><circle cx={chart.x(estimate(model, 1, 1) ?? 0)} cy={chart.y(model[axis] ?? 0)} r="6" class={`chart-dot tone-${providerTone(model.provider)}`} tabindex="0" role="img" aria-label={readout(model)}><title>{readout(model)}</title></circle></g>)}
        {labelled.map((model, index) => <text class="point-label" x={chart.x(estimate(model, 1, 1) ?? 0) + (index === 0 ? -8 : 8)} y={chart.y(model[axis] ?? 0) - 12} text-anchor={index === 0 ? 'end' : 'start'}>{modelName(model)}</text>)}
      </svg>
    </div>
    <div class="chart-legend"><span><i class="tone-blue" />OpenAI</span><span><i class="tone-orange" />Anthropic</span><span><i class="tone-green" />Google</span><span><i class="tone-slate" />그 외</span></div>
    <p class="chart-readout" data-chart-readout role="status" aria-live="polite">{chart.models[0] ? readout(chart.models[0]) : '관측값 대기'}</p>
    <p class="board-caption" data-scatter-hint hidden={chart.models.length === 0}>점 선택으로 상세 보기</p>
  </GlassPanel>
  <TerminalBenchPanel board={board} />
  <GlassPanel class="usage-panel" label="주간 토큰 사용량">
    <div class="panel-heading"><div><h2>주간 사용량</h2></div></div>
    <p class="board-caption">OpenRouter 내 입력 + 출력 토큰</p>
    <ol class="usage-bars" data-usage-bars>
      {usage.map((model, index) => <li><div><span class="usage-rank">{index + 1}</span><span class="usage-name">{modelName(model)}</span><strong>{compact(model.tokens7d)}</strong></div><div class="usage-track"><span style={`width:${(model.tokens7d ?? 0) / (usage[0]?.tokens7d || 1) * 100}%`} /></div></li>)}
    </ol>
    <p class="board-empty" data-usage-empty hidden={usage.length > 0}>현재 공개 사용량 데이터를 확인할 수 없습니다. 집계가 확보되면 여기에 표시됩니다.</p>
    <a class="source-link" href="https://openrouter.ai/rankings" target="_blank" rel="noopener noreferrer">집계 원문 확인 ↗</a>
  </GlassPanel>
</div>
```

- [ ] **Step 5: `src/pages/status.astro` 전체 교체**

```astro
---
import Base from '../layouts/Base.astro';
import GlassPanel from '../components/status/GlassPanel.astro';
import BoardCharts from '../components/status/BoardCharts.astro';
import ModelRow from '../components/status/ModelRow.astro';
import raw from '../../public/data/model-board.json';
import { axisMaxima, boardSchema, canonicalModels, cardMetrics, EMPTY, leaderNote, metricKeys, metricValue, metrics, modelName, observedAt, ranked, sourceCopy, strengthMap, valueNote, valuePick } from '../lib/model-board';
import { href } from '../lib/mag';
import { modelArtwork } from '../lib/model-artwork';
import '../styles/model-board.css';
const board = boardSchema.parse(raw);
const canonical = canonicalModels(board.models);
const leaders = ranked(canonical, 'intelligence');
const maxima = axisMaxima(canonical);
const strengths = strengthMap(canonical);
const pick = valuePick(canonical);
const pickArt = modelArtwork(pick ?? undefined);
const providers = [...new Set(canonical.map((model) => model.provider))].sort();
---
<Base title="AI 모델 상태판" description="AI 모델의 종합·코딩·에이전트 지수, Terminal-Bench 4.0, 생성 속도, 토큰 비용과 실제 사용량을 출처와 함께 비교하는 DADES 상태판." active="status" layout="immersive">
  <div class="model-board" data-model-board data-feed={href('/data/model-board.json')}>
    <header class="board-heading">
      <div><h1>AI 상태판</h1></div>
      <div class="board-update"><span class="update-state" data-freshness>관측값</span><p><time datetime={board.fetchedAt} data-board-time>{observedAt(board)}</time> KST 확인</p><button type="button" class="glass-button refresh-button" data-refresh data-js-only hidden><span aria-hidden="true">↻</span> 새로 확인</button></div>
    </header>
    <p class="board-feedback" data-board-feedback role="status" aria-live="polite"></p>
    <div class="board-highlights" aria-label="축별 선두 모델">
      {cardMetrics.map((metric) => {
        const leader = ranked(canonical, metric)[0];
        const artwork = modelArtwork(leader);
        return <a class="highlight-card" href="#leaderboard" data-metric-shortcut={metric} data-leader-model={leader?.id} hidden={metric === 'speed' && !leader}>
          <img class="highlight-art" src={artwork ?? undefined} alt="" width="180" height="180" decoding="async" hidden={!artwork} data-leader-art={metric} />
          <div class="glass-panel highlight-glass">
          <div class="highlight-label"><span>{metrics[metric].title}</span><span aria-hidden="true">↗</span></div>
          <div class="highlight-value"><strong data-leader-value={metric}>{leader ? metricValue(leader, metric) : EMPTY}</strong><span>{metrics[metric].unit}</span></div>
          <p data-leader-name={metric}>{leader ? modelName(leader) : '관측 대기'}</p><small class="metric-date" data-leader-note={metric}>{leaderNote(board, leader, metric)}</small>
          </div>
        </a>;
      })}
      <a class="highlight-card" href="#value-chart" data-value-card data-leader-model={pick?.id} hidden={!pick}>
        <img class="highlight-art" src={pickArt ?? undefined} alt="" width="180" height="180" decoding="async" hidden={!pickArt} data-leader-art="value" />
        <div class="glass-panel highlight-glass">
        <div class="highlight-label"><span>{metrics.cost.title}</span><span aria-hidden="true">↘</span></div>
        <div class="highlight-value"><strong data-leader-value="value">{pick ? metricValue(pick, 'cost') : EMPTY}</strong><span>{metrics.cost.unit}</span></div>
        <p data-leader-name="value">{pick ? modelName(pick) : '관측 대기'}</p><small class="metric-date" data-leader-note="value">{pick ? valueNote(canonical, pick) : ''}</small>
        </div>
      </a>
    </div>
    <BoardCharts board={board} models={canonical} />
    <GlassPanel class="leaderboard-panel" label="모델 리더보드">
      <div class="panel-heading" id="leaderboard"><div><h2>리더보드</h2></div><a class="source-link" href="#board-method">지표 읽는 법 ↗</a></div>

      <div class="board-toolbar" data-js-only hidden>
        <div class="metric-switch" role="group" aria-label="순위 기준">{metricKeys.map((metric) => <button type="button" data-metric={metric} aria-pressed={metric === 'intelligence'}>{metrics[metric].label}</button>)}</div>
        <div class="board-search"><label><span class="sr-only">모델 검색</span><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.6"/></svg><input type="search" placeholder="모델 이름 검색" maxlength="100" data-model-query /></label><label><span class="sr-only">모델 개발사</span><select data-model-provider><option value="all">모든 개발사</option>{providers.map((provider) => <option value={provider}>{provider}</option>)}</select></label></div>
      </div>
      <div class="ranking-context"><p data-ranking-count>종합 · {leaders.length}개 · 높은 순</p></div>
      <div class="board-table-scroll" tabindex="0" role="region" aria-label="모델 비교 표, 작은 화면에서는 가로로 스크롤">
        <table class="board-table"><caption class="sr-only">모델별 종합·코딩·에이전트 지수 지문, 강점, Terminal-Bench 4.0 정확도, 생성 속도, 1M+1M 토큰 비용, 주간 사용량</caption><thead><tr><th scope="col">순위</th><th scope="col">모델 <span data-js-only hidden>· 최대 3개 비교</span></th><th scope="col" class="fingerprint-head">종합 · 코딩 · 에이전트</th><th scope="col" class="strength-head">강점</th><th scope="col" data-column="terminalBench">TB 4.0 <small>%</small></th><th scope="col" data-column="speed">속도 <small>tok/s</small></th><th scope="col" data-column="cost">비용 <small>$ / 1M+1M</small></th><th scope="col" data-column="tokens7d">사용량 <small>주간 tokens</small></th><th scope="col" class="axis-value" data-column="intelligence" data-axis-head aria-sort="descending">종합 <small>AA</small></th></tr></thead><tbody data-model-rows>{leaders.slice(0, 20).map((model, index) => <ModelRow model={model} rank={index + 1} metric="intelligence" maxima={maxima} strengths={strengths.get(model.id) ?? []} />)}</tbody></table>
      </div>
      <div class="board-empty" data-ranking-empty hidden><h3>일치하는 모델이 없습니다</h3><p>검색어 또는 개발사를 바꿔 보세요.</p><button type="button" class="glass-button" data-reset>조건 초기화</button></div>
      <div class="table-bottom"><p>측정값이 있는 정식 모델만 표시</p><button type="button" class="glass-button" data-more data-js-only hidden>20개 더 보기 <span aria-hidden="true">↓</span></button></div>
    </GlassPanel>
    <GlassPanel class="comparison-panel" label="선택 모델 비교와 토큰 비용 계산">
      <div class="panel-heading"><div><h2 id="model-comparison">모델 비교</h2></div><span class="selection-count" data-selection-count>0 / 3</span></div>
      <p class="board-caption" data-compare-hint>표에서 최대 3개 선택</p>
      <div class="budget-inputs" data-js-only hidden><label>입력 토큰 <span><input type="number" min="0" max="100" step="0.1" value="1" data-budget="input" /> 백만</span></label><label>출력 토큰 <span><input type="number" min="0" max="100" step="0.1" value="1" data-budget="output" /> 백만</span></label><p>기본 단가 기준 · 추가 과금 별도</p></div>
      <div class="model-comparison" data-comparison></div>
      <noscript><p class="board-caption">비교 및 비용 계산은 JavaScript가 필요합니다. 위 표의 값은 그대로 확인할 수 있습니다.</p></noscript>
    </GlassPanel>
    <GlassPanel class="method-panel" label="데이터 출처와 읽는 법">
      <details class="source-details" id="board-method"><summary>데이터 기준과 출처 <span aria-hidden="true">+</span></summary>
        <div class="method-grid"><div><h3>세 지수는 합치지 않습니다</h3><p>종합·코딩·에이전트는 Artificial Analysis 지수를 OpenRouter가 전달한 값입니다. 원래 척도 그대로 쓰고 하나의 점수로 합치지 않습니다. 확인 시각은 벤치마크 실행일과 다릅니다.</p></div><div><h3>Terminal-Bench는 조합의 기록입니다</h3><p>tbench.ai 공식 4.0 리더보드의 에이전트+모델 조합 결과입니다. 표의 모델 값은 그중 최고 정확도 하나이며, 어떤 에이전트였는지는 셀 설명과 옆 패널에 있습니다. SWE-bench Verified는 독립 출처(공식 리더보드 2026-02, Epoch AI 2026-06)가 최신 모델을 다루지 않아 싣지 않습니다.</p></div><div><h3>속도는 트래픽 최다 제공사 기준</h3><p>OpenRouter 모델 페이지가 공개한 제공사별 p50 출력 속도입니다. 최근 창에서 요청이 가장 많았던 표준 경로 하나를 고르고, 창 길이와 요청 수를 비교 패널에 함께 둡니다. 관측이 없으면 0이 아니라 비워 둡니다.</p></div></div>
        <ul class="rule-list"><li>강점 라벨: 종합·코딩·에이전트는 해당 지수 상위 3위, 빠름은 속도 상위 3위.</li><li>가성비: 더 싸면서 종합이 높은 모델이 없는 모델 중 종합 지수가 선두의 80% 이상인 것. 카드는 그중 최저 비용.</li><li>batch·free 변형은 정식 모델 행에 접고 칩으로만 표시합니다. 값은 정식 경로 기준입니다.</li></ul>
        <ul data-board-sources>{board.sources.map((source) => <li><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a><span>{source.status === 'ok' ? '확인' : '미제공'} · {source.observedAt ? new Date(source.observedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '관측 시각 없음'}</span><p>{sourceCopy(source)}</p></li>)}</ul>
      </details>
      <p class="board-caption">지수: <a href="https://artificialanalysis.ai/" target="_blank" rel="noopener noreferrer">Artificial Analysis</a> via <a href="https://openrouter.ai/benchmarks" target="_blank" rel="noopener noreferrer">OpenRouter</a>. Terminal-Bench: <a href="https://www.tbench.ai/" target="_blank" rel="noopener noreferrer">Stanford / Harbor / Laude Institute</a>. 가격·속도·사용량: <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">OpenRouter</a>.</p>
    </GlassPanel>
    <a class="compare-dock" data-compare-dock href="#model-comparison" hidden>선택한 모델 비교 <span data-dock-count>0 / 3</span><span aria-hidden="true">↓</span></a>
    <script type="application/json" id="model-board-data" set:html={JSON.stringify(board).replaceAll('<', '\\u003c')} />
  </div>
  <script>import '../lib/model-board-client';</script>
</Base>
```

- [ ] **Step 6: `src/styles/model-board.css` 수정**

아래 여섯 군데를 바꾼다. 나머지는 그대로.

(a) `.board-highlights { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; margin-bottom:20px; }` →

```css
.board-highlights { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:16px; margin-bottom:20px; }
.board-highlights:has(.highlight-card[hidden]) { grid-template-columns:repeat(4,minmax(0,1fr)); }
```

(b) `.board-charts { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:20px; margin-bottom:24px; }` →

```css
.board-charts { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr); gap:20px; margin-bottom:24px; }
```

(c) `.board-table thead th:nth-child(2) { text-align:left; }` →

```css
.board-table thead th:nth-child(2),.board-table thead th.fingerprint-head,.board-table thead th.strength-head { text-align:left; }
```

(d) `.cell-bar { … }` 줄 바로 아래에 추가:

```css
.fingerprint-cell,.strength-cell { text-align:left; white-space:nowrap; }
.fingerprint { display:inline-flex; align-items:flex-end; gap:3px; height:22px; vertical-align:middle; }
.fp-bar { display:block; width:9px; height:max(2px,var(--fp)); border-radius:2px; background:var(--board-accent); opacity:.28; }
.fp-bar.fp-active { opacity:.9; }
.fp-bar.fp-missing { height:100%; background:transparent; border:1px dashed var(--board-line); opacity:1; }
.strength-pill { display:inline-block; margin-right:4px; padding:2px 8px; border-radius:var(--radius-pill); background:var(--board-active); color:var(--board-accent); font-size:12px; font-weight:560; }
.variant-chip { display:inline-block; margin-left:6px; padding:1px 6px; border-radius:var(--radius-pill); background:var(--board-active); color:var(--board-muted); font-size:11px; font-weight:400; vertical-align:1px; }
.axis-value { display:none; }
.numeric.empty > span { color:var(--board-muted); opacity:.55; }
.frontier-line { fill:none; stroke:var(--board-accent); stroke-width:1.5px; stroke-dasharray:4 4; opacity:.6; }
.terminal-rows { gap:20px; }
.terminal-agent { display:block; margin:4px 0 0 28px; font-size:12px; color:var(--board-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.terminal-panel > .source-link { margin-top:20px; }
.rule-list { padding:0 0 8px; list-style:none; display:grid; gap:8px; color:var(--board-muted); font-size:14px; }
```

(e) `@media(max-width:1199px) { … }` 한 줄을 아래로 교체:

```css
@media(max-width:1199px) { .board-highlights { grid-template-columns:repeat(3,minmax(0,1fr)); }.board-highlights:has(.highlight-card[hidden]) { grid-template-columns:repeat(2,minmax(0,1fr)); }.board-charts { grid-template-columns:1fr 1fr; }.board-charts .value-panel { grid-column:1 / -1; }.chart-hint { display:none; } }
```

(f) `@media(max-width:809.98px) { … }` 블록 안 `.board-charts { grid-template-columns:1fr; }`를 아래로 교체:

```css
  .board-highlights { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .board-highlights:not(:has(.highlight-card[hidden])) .highlight-card:last-child { grid-column:span 2; }
  .board-charts { grid-template-columns:1fr; }
  .board-charts .value-panel { grid-column:auto; }
```

(g) `@media(max-width:599px)` 블록 안에서:
- `.metric-switch { width:100%; }` → `.metric-switch { width:100%; overflow-x:auto; scrollbar-width:none; }`
- `.metric-switch button { flex:1; padding:10px 8px; font-size:14px; }` → `.metric-switch button { flex:1 0 auto; padding:10px 14px; font-size:14px; }`
- `.has-board-js .board-table thead th:nth-child(n+3):not([aria-sort]),.has-board-js .board-table tbody td:not(.board-rank):not(.metric-active) { display:none; }` →

```css
  .has-board-js .board-table thead th:nth-child(n+4):not([aria-sort]),.has-board-js .board-table tbody td:not(.board-rank):not(.fingerprint-cell):not(.metric-active) { display:none; }
  .has-board-js .board-table th.axis-value[aria-sort],.has-board-js .board-table td.axis-value.metric-active { display:table-cell; }
  .fingerprint-cell { width:44px; }
  .fp-bar { width:7px; }
  .variant-chip { display:none; }
```

- [ ] **Step 7: 빌드와 눈 확인**

Run: `npm run build 2>&1 | tail -3`
Expected: 오류 없이 `Complete!`.

Run: `grep -c 'class="fp-bar' dist/status/index.html; grep -o 'data-terminal-rows' dist/status/index.html | head -1; grep -o 'data-value-card' dist/status/index.html | head -1`
Expected: `60`(20행 × 3막대) 이상, `data-terminal-rows`, `data-value-card`.

- [ ] **Step 8: 커밋**

```bash
git add src/components/status src/pages/status.astro src/styles/model-board.css
git commit -m "상태판 화면 v2 — 축별 선두 5칸, Terminal-Bench 패널, 지문형 리더보드, 가성비 전선

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 브라우저 렌더 — render·charts·client

**Files:**
- Modify: `src/lib/model-board-render.ts` (전체 교체)
- Modify: `src/lib/model-board-charts.ts` (전체 교체)
- Modify: `src/lib/model-board-client.ts` (전체 교체)

**Interfaces:**
- Consumes: Task 7 export, Task 8 DOM 훅.
- Produces: `modelRow(model, index, { metric, maxima, strengths, selected })`, `fingerprintNode(model, maxima, metric)`, `comparisonCard(model, budget)`, `updateCharts(root, board, models, axis)`.

- [ ] **Step 1: `src/lib/model-board-render.ts` 전체 교체**

```ts
import { amount, compact, dollars, EMPTY, estimate, fingerprint, isAxis, metricValue, metrics, modelName, percent, variantChip, type Axis, type CanonicalModel, type Metric, type Model, type Strength } from './model-board';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

export function fingerprintNode(model: Model, maxima: Record<Axis, number>, metric: Metric) {
  const bars = fingerprint(model, maxima);
  const summary = bars.map((bar) => `${metrics[bar.axis].label} ${amount(bar.value)}`).join(' · ');
  const node = element('span', '', 'fingerprint');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', summary);
  node.title = summary;
  for (const bar of bars) {
    const item = element('i', '', `fp-bar${bar.axis === metric ? ' fp-active' : ''}${bar.ratio === null ? ' fp-missing' : ''}`);
    item.style.setProperty('--fp', `${Math.round((bar.ratio ?? 0) * 100)}%`);
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
  label.append(checkbox);
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
    ['종합 · AA 지수', amount(model.intelligence)], ['코딩 · AA 지수', amount(model.coding)], ['에이전트 · AA 지수', amount(model.agentic)],
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
```

- [ ] **Step 2: `src/lib/model-board-charts.ts` 전체 교체**

```ts
import { amount, compact, dollars, estimate, metrics, modelName, providerTone, ranked, scatter, terminalRows, terminalUpdated, type Axis, type CanonicalModel, type Model, type ModelBoard } from './model-board';
import { element } from './model-board-render';

function svgNode(tag: string, attributes: Record<string, string | number>, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.textContent = text;
  return node;
}

export function updateCharts(root: HTMLElement, board: ModelBoard, models: readonly CanonicalModel[], axis: Axis) {
  const chart = scatter(models, axis);
  const readout = (model: Model) => `${modelName(model)} · ${metrics[axis].label} ${amount(model[axis])} · 기준 비용 ${dollars(estimate(model, 1, 1))}`;
  const svg = root.querySelector<SVGElement>('.scatter-chart');
  if (svg) {
    const items: SVGElement[] = [];
    for (const part of [0, .25, .5, .75, 1]) {
      const score = chart.maxScore * part;
      items.push(svgNode('line', { x1: 55, x2: 605, y1: chart.y(score), y2: chart.y(score), class: 'chart-grid' }), svgNode('text', { x: 42, y: chart.y(score) + 4, 'text-anchor': 'end' }, amount(score, 0)));
    }
    for (const tick of chart.ticks) items.push(svgNode('text', { x: chart.x(tick), y: 285, 'text-anchor': 'middle' }, `$${tick}`));
    items.push(svgNode('text', { x: 55, y: 17, class: 'axis-title', 'data-axis-title': '' }, `${metrics[axis].label} · AA 지수 ↑`), svgNode('text', { x: 605, y: 305, 'text-anchor': 'end' }, '비용 USD · 로그 눈금 →'));
    if (chart.frontierPoints) items.push(svgNode('polyline', { class: 'frontier-line', points: chart.frontierPoints, 'data-frontier': '' }));
    for (const model of chart.models) {
      const label = readout(model);
      const dot = svgNode('circle', { cx: chart.x(estimate(model, 1, 1) ?? 0), cy: chart.y(model[axis] ?? 0), r: 6, class: `chart-dot tone-${providerTone(model.provider)}`, tabindex: 0, role: 'img', 'aria-label': label });
      dot.append(svgNode('title', {}, label));
      items.push(dot);
    }
    const labelled = [chart.models[0], chart.frontier[0]].filter((model, index, list): model is Model => Boolean(model) && list.indexOf(model) === index);
    labelled.forEach((model, index) => {
      items.push(svgNode('text', { class: 'point-label', x: chart.x(estimate(model, 1, 1) ?? 0) + (index === 0 ? -8 : 8), y: chart.y(model[axis] ?? 0) - 12, 'text-anchor': index === 0 ? 'end' : 'start' }, modelName(model)));
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
```

- [ ] **Step 3: `src/lib/model-board-client.ts` 전체 교체**

```ts
import { axisMaxima, boardSchema, canonicalModels, cardMetrics, EMPTY, isAxis, isMetric, leaderNote, metrics, metricValue, modelName, observedAt, ranked, sourceCopy, strengthMap, valueNote, valuePick, type Axis, type CanonicalModel, type Metric, type Strength } from './model-board';
import { comparisonCard, element, modelRow } from './model-board-render';
import { updateCharts } from './model-board-charts';
import { modelArtwork } from './model-artwork';

function mount(root: HTMLElement) {
  const payload = document.getElementById('model-board-data');
  if (!payload?.textContent) return;
  const initial = boardSchema.safeParse(JSON.parse(payload.textContent));
  if (!initial.success) return;
  let board = initial.data;
  let canonical: CanonicalModel[] = canonicalModels(board.models);
  let maxima = axisMaxima(canonical);
  let strengths: Map<string, Strength[]> = strengthMap(canonical);
  let metric: Metric = 'intelligence';
  let axis: Axis = 'intelligence';
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
  const axisHead = root.querySelector<HTMLElement>('[data-axis-head]');
  if (!query || !provider || !rows || !feedback || !empty || !more || !refresh) return;
  root.classList.add('has-board-js');
  root.querySelectorAll<HTMLElement>('[data-js-only]').forEach((node) => { node.hidden = false; });
  const saveURL = () => {
    const url = new URL(location.href);
    for (const [key, value] of [['metric', metric === 'intelligence' ? '' : metric], ['q', query.value.trim()], ['provider', provider.value === 'all' ? '' : provider.value]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  };
  const setArt = (key: string, id: string | undefined) => {
    const image = root.querySelector<HTMLImageElement>(`[data-leader-art="${key}"]`);
    if (!image) return;
    const artwork = modelArtwork(id ? { id } : undefined);
    image.hidden = !artwork;
    if (artwork) image.src = artwork; else image.removeAttribute('src');
  };
  const renderCards = () => {
    for (const key of cardMetrics) {
      const leader = ranked(canonical, key)[0];
      const card = root.querySelector<HTMLElement>(`[data-metric-shortcut="${key}"]`);
      if (card) {
        if (leader) card.dataset.leaderModel = leader.id; else delete card.dataset.leaderModel;
        if (key === 'speed') card.hidden = !leader;
      }
      setArt(key, leader?.id);
      const value = root.querySelector(`[data-leader-value="${key}"]`);
      const name = root.querySelector(`[data-leader-name="${key}"]`);
      const note = root.querySelector(`[data-leader-note="${key}"]`);
      if (value) value.textContent = leader ? metricValue(leader, key) : EMPTY;
      if (name) name.textContent = leader ? modelName(leader) : '관측 대기';
      if (note) note.textContent = leaderNote(board, leader, key);
    }
    const pick = valuePick(canonical);
    const card = root.querySelector<HTMLElement>('[data-value-card]');
    if (card) {
      card.hidden = !pick;
      if (pick) card.dataset.leaderModel = pick.id; else delete card.dataset.leaderModel;
    }
    setArt('value', pick?.id);
    const value = root.querySelector('[data-leader-value="value"]');
    const name = root.querySelector('[data-leader-name="value"]');
    const note = root.querySelector('[data-leader-note="value"]');
    if (value) value.textContent = pick ? metricValue(pick, 'cost') : EMPTY;
    if (name) name.textContent = pick ? modelName(pick) : '관측 대기';
    if (note) note.textContent = pick ? valueNote(canonical, pick) : '';
  };
  const renderComparison = () => {
    const models = canonical.filter((model) => selected.has(model.id));
    root.querySelector('[data-comparison]')?.replaceChildren(...models.map((model) => comparisonCard(model, budget)));
    const count = root.querySelector('[data-selection-count]');
    if (count) count.textContent = `${selected.size} / 3`;
    const dock = root.querySelector<HTMLElement>('[data-compare-dock]');
    if (dock) dock.hidden = selected.size === 0;
    const dockCount = root.querySelector('[data-dock-count]');
    if (dockCount) dockCount.textContent = `${selected.size} / 3`;
    root.querySelectorAll<HTMLInputElement>('[data-compare]').forEach((checkbox) => { checkbox.checked = selected.has(checkbox.dataset.compare ?? ''); });
  };
  const render = () => {
    const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = canonical.filter((model) => (provider.value === 'all' || model.provider === provider.value) && terms.every((term) => `${model.name} ${model.provider}`.toLowerCase().includes(term)));
    const sorted = ranked(filtered, metric);
    rows.replaceChildren(...sorted.slice(0, limit).map((model, index) => modelRow(model, index, { metric, maxima, strengths: strengths.get(model.id) ?? [], selected })));
    more.hidden = sorted.length <= limit;
    empty.hidden = sorted.length > 0;
    const heading = empty.querySelector('h3'); const text = empty.querySelector('p');
    if (heading) heading.textContent = filtered.length && sorted.length === 0 ? '이 지표는 아직 관측값이 없습니다' : '일치하는 모델이 없습니다';
    if (text) text.textContent = filtered.length && sorted.length === 0 ? '출처가 값을 제공하면 자동으로 순위에 반영합니다. 다른 지표를 살펴보세요.' : '검색어 또는 개발사를 바꿔 보세요.';
    const count = root.querySelector('[data-ranking-count]');
    if (count) count.textContent = `${metrics[metric].label} · ${sorted.length}개 · ${metrics[metric].ascending ? '낮은' : '높은'} 순`;
    root.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.metric === metric)));
    if (axisHead) {
      axisHead.dataset.column = axis;
      axisHead.replaceChildren(document.createTextNode(`${metrics[axis].label} `), element('small', 'AA'));
    }
    root.querySelectorAll<HTMLElement>('[data-column]').forEach((column) => {
      if (column.dataset.column === metric) column.setAttribute('aria-sort', metrics[metric].ascending ? 'ascending' : 'descending'); else column.removeAttribute('aria-sort');
    });
  };
  const setMetric = (value: Metric, redraw = true) => {
    metric = value;
    const nextAxis: Axis = isAxis(value) ? value : 'intelligence';
    const axisChanged = nextAxis !== axis;
    axis = nextAxis;
    limit = 20;
    render();
    if (redraw && axisChanged) updateCharts(root, board, canonical, axis);
    saveURL();
  };
  const freshness = () => {
    const source = board.sources.find((entry) => entry.id === 'openrouter-catalog');
    const age = source?.status === 'ok' && source.observedAt ? Date.now() - new Date(source.observedAt).getTime() : Infinity;
    const state = root.querySelector<HTMLElement>('[data-freshness]');
    if (state) { state.textContent = age > 2 * 60 * 60 * 1000 ? '갱신 지연' : '관측값'; state.dataset.stale = String(age > 2 * 60 * 60 * 1000); }
  };
  const restore = () => {
    const params = new URLSearchParams(location.search);
    const value = params.get('metric');
    query.value = (params.get('q') ?? '').slice(0, 100);
    const author = params.get('provider') ?? 'all';
    provider.value = [...provider.options].some((option) => option.value === author) ? author : 'all';
    setMetric(isMetric(value) ? value : 'intelligence', false);
    updateCharts(root, board, canonical, axis);
  };
  for (const button of root.querySelectorAll<HTMLElement>('[data-metric],[data-metric-shortcut]')) button.addEventListener('click', () => {
    const value = button.dataset.metric ?? button.dataset.metricShortcut ?? null;
    if (isMetric(value)) setMetric(value);
  });
  query.addEventListener('input', () => { limit = 20; render(); saveURL(); });
  provider.addEventListener('change', () => { limit = 20; render(); saveURL(); });
  root.querySelector('[data-reset]')?.addEventListener('click', () => { query.value = ''; provider.value = 'all'; setMetric('intelligence'); query.focus(); });
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
        canonical = canonicalModels(board.models);
        maxima = axisMaxima(canonical);
        strengths = strengthMap(canonical);
        const author = provider.value;
        provider.replaceChildren(...['all', ...new Set(canonical.map((model) => model.provider))].sort().map((name) => { const option = element('option', name === 'all' ? '모든 개발사' : name); option.value = name; return option; }));
        provider.value = [...provider.options].some((option) => option.value === author) ? author : 'all';
        for (const id of selected) if (!canonical.some((model) => model.id === id)) selected.delete(id);
        renderCards();
        const time = root.querySelector<HTMLTimeElement>('[data-board-time]'); if (time) { time.dateTime = board.fetchedAt; time.textContent = observedAt(board); }
        root.querySelector('[data-board-sources]')?.replaceChildren(...board.sources.map((source) => {
          const row = element('li'); const link = element('a', `${source.label} ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          row.append(link, element('span', `${source.status === 'ok' ? '확인' : '미제공'} · ${source.observedAt ?? '관측 시각 없음'}`), element('p', sourceCopy(source))); return row;
        }));
        render(); renderComparison(); updateCharts(root, board, canonical, axis);
        if (focused) [...root.querySelectorAll<HTMLInputElement>('[data-compare]')].find((input) => input.dataset.compare === focused)?.focus({ preventScroll: true });
      }
      if (manual || changed) feedback.textContent = changed ? '새 관측값으로 업데이트했습니다.' : '새로 확인했습니다. 현재 표시된 관측값이 최신 파일입니다.';
    } catch (error) {
      feedback.textContent = error instanceof Error ? '새 데이터를 확인하지 못했습니다. 마지막 관측값을 유지합니다.' : '데이터 확인 중 오류가 발생했습니다. 마지막 관측값을 유지합니다.';
    } finally {
      pending = false; refresh.disabled = false; freshness();
      if (restoreRefreshFocus && document.activeElement === document.body) refresh.focus({ preventScroll: true });
    }
  };
  refresh.addEventListener('click', () => { void refreshBoard(true); });
  window.addEventListener('popstate', restore);
  restore(); freshness();
  window.setInterval(() => { freshness(); void refreshBoard(false); }, 60000);
}
const root = document.querySelector<HTMLElement>('[data-model-board]');
if (root) mount(root);
```

- [ ] **Step 4: 타입 검사와 빌드**

Run: `npx tsc --noEmit -p tsconfig.json; echo "tsc exit $?"`
Expected: `tsc exit 0`. `modelArtwork(id ? { id } : undefined)`에서 `Pick<Model,'id'>` 타입 오류가 나면 `src/lib/model-artwork.ts`의 시그니처가 `model?: Pick<Model, 'id'>`인지 확인한다(현재 그렇다).

Run: `npm run build 2>&1 | tail -3`
Expected: `Complete!`.

- [ ] **Step 5: 브라우저 동작 확인**

```bash
npx astro preview --port 4321 > /tmp/preview.log 2>&1 &
sleep 3
node -e '
const { chromium } = require("/home/seory0/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://127.0.0.1:4321/DADES/status/", { waitUntil: "networkidle" });
  await page.waitForSelector(".model-board.has-board-js");
  const before = await page.$$eval("[data-model-rows] tr", (rows) => rows.length);
  await page.click("[data-metric=\"coding\"]");
  const active = await page.$$eval(".fp-bar.fp-active", (bars) => bars.length);
  const axisHead = await page.$eval("[data-axis-head]", (th) => th.dataset.column + ":" + th.getAttribute("aria-sort"));
  const axisTitle = await page.$eval("[data-axis-title]", (t) => t.textContent);
  await page.click("[data-metric=\"cost\"]");
  const firstCost = await page.$eval("[data-model-rows] tr td.metric-active span", (s) => s.textContent);
  await page.click("[data-metric-shortcut=\"speed\"]");
  const speedSort = await page.$eval("[data-column=\"speed\"]", (th) => th.getAttribute("aria-sort"));
  await page.check("[data-model-rows] tr:first-child [data-compare]");
  const compareRows = await page.$$eval("[data-comparison] dt", (dts) => dts.map((d) => d.textContent));
  console.log(JSON.stringify({ before, active, axisHead, axisTitle, firstCost, speedSort, compareRows, errors }, null, 1));
  await browser.close();
})();
'
kill %1
```
Expected: `before: 20`, `active: 20`(코딩 막대 20개 강조), `axisHead: "coding:descending"`, `axisTitle: "코딩 · AA 지수 ↑"`, `firstCost`가 `$0`류의 최저 비용, `speedSort: "descending"`, `compareRows`에 `Terminal-Bench 4.0`·`속도 관측 요청 수` 포함, `errors: []`.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/model-board-render.ts src/lib/model-board-charts.ts src/lib/model-board-client.ts
git commit -m "상태판 브라우저 렌더 v2 — 7개 지표 전환, 지문·강점 행, 축 따라가는 산점도, 카드 갱신

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 사이트 계약 테스트와 전체 검증

**Files:**
- Modify: `tests/site-contract.test.mjs` (status 절)

- [ ] **Step 1: 테스트 수정**

`status exposes sourced model comparisons…` 테스트에서 `for (const metric of ['intelligence', 'outputPrice', 'speed', 'tokens7d'])`를 아래로 바꾸고 세 줄을 덧붙인다.

```js
  for (const metric of ['intelligence', 'terminalBench', 'speed', 'cost', 'tokens7d']) {
    assert.ok(status.includes('data-column="' + metric + '"'));
  }
  assert.match(status, /data-terminal-rows/);
  assert.match(status, /data-value-card/);
  assert.match(status, /class="fingerprint"/);
```

`assert.ok(snapshot.models.length > 0);` 다음 줄에 `assert.equal(snapshot.schemaVersion, 2);` 추가.

- [ ] **Step 2: 전체 검증**

```bash
npm test 2>&1 | grep -E "^# (pass|fail)"
npx tsc --noEmit -p tsconfig.json && echo tsc-ok
npm run build 2>&1 | tail -2
npx astro preview --port 4321 > /tmp/preview.log 2>&1 &
sleep 3
npm run test:site 2>&1 | grep -E "^# (pass|fail)"
kill %1
```
Expected: 단위 `# fail 0`(status 55 + rules 6 + editorial), `tsc-ok`, 빌드 `Complete!`, 사이트 계약 `# fail 0`.

- [ ] **Step 3: 커밋**

```bash
git add tests/site-contract.test.mjs
git commit -m "상태판 v2 사이트 계약 — 새 지표 열·Terminal-Bench 패널·가성비 카드 확인

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 시각 QA 캡처와 PR

**Files:**
- Create: `artifacts/qa/status-v2-capture.cjs`
- Modify: `.gitignore` (`artifacts/qa/status-v2/` 추가)
- 브랜치 `qa/status-v2-shots`(스크린샷 전용, 워크트리로 생성)

- [ ] **Step 1: 캡처 스크립트 작성 — `artifacts/qa/status-v2-capture.cjs`**

```js
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const { chromium } = require('/home/seory0/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const origin = process.env.DADES_TEST_ORIGIN ?? 'http://127.0.0.1:4321';
const out = path.join(__dirname, 'status-v2');
mkdirSync(out, { recursive: true });
const jobs = [
  { theme: 'ink', width: 1440, height: 1000, metric: 'intelligence' },
  { theme: 'ink', width: 1440, height: 1000, metric: 'coding' },
  { theme: 'ink', width: 390, height: 844, metric: 'intelligence' },
  { theme: 'white', width: 1440, height: 1000, metric: 'intelligence' },
  { theme: 'white', width: 390, height: 844, metric: 'intelligence' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  for (const job of jobs) {
    const context = await browser.newContext({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1, isMobile: job.width < 810, reducedMotion: 'reduce' });
    await context.addInitScript((theme) => localStorage.setItem('dades:theme', theme), job.theme);
    const page = await context.newPage();
    const suffix = job.metric === 'intelligence' ? '' : `?metric=${job.metric}`;
    await page.goto(`${origin}/DADES/status/${suffix}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.model-board.has-board-js');
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((node) => node.classList.add('is-revealed')));
    await page.waitForTimeout(800);
    const file = path.join(out, `status-${job.theme}-${job.width}${job.metric === 'intelligence' ? '' : `-${job.metric}`}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('saved', file);
    await context.close();
  }
  await browser.close();
})();
```

`.gitignore`의 `artifacts/qa/final/` 줄 아래에 `artifacts/qa/status-v2/`를 추가한다.

- [ ] **Step 2: 캡처 실행**

```bash
npm run build 2>&1 | tail -1
npx astro preview --port 4321 > /tmp/preview.log 2>&1 &
sleep 3
node artifacts/qa/status-v2-capture.cjs
kill %1
ls -la artifacts/qa/status-v2/
```
Expected: PNG 5장. 각 파일을 `Read`로 열어 확인할 것: 상단 5칸(속도 카드에 제공사명), 2행 세 패널(산점도 점선 전선, Terminal-Bench 상위 6, 사용량), 리더보드에 지문·강점 필·TB %·속도·비용·사용량, 390에서는 순위·모델·지문·종합값 네 열과 2열 카드. `-coding` 캡처에서는 두 번째 막대만 진하고 축 머리글이 `코딩 · AA 지수 ↑`. 어긋나면 CSS/컴포넌트를 고치고 Task 8·9 커밋에 이어 별도 커밋으로 남긴다.

- [ ] **Step 3: 스크린샷 브랜치 푸시**

```bash
git worktree add /tmp/status-v2-shots --detach
cd /tmp/status-v2-shots && git checkout --orphan qa/status-v2-shots && git rm -rfq . && mkdir -p shots && cp /home/seory0/DADES/artifacts/qa/status-v2/*.png shots/ && git add shots && git commit -qm "상태판 v2 QA 캡처 2026-09-09" && git push -q origin qa/status-v2-shots
git worktree remove --force /tmp/status-v2-shots
```
Expected: `origin/qa/status-v2-shots`에 `shots/*.png` 5장. URL 형식 `https://raw.githubusercontent.com/SEORY0/DADES/qa/status-v2-shots/shots/status-ink-1440.png`.

- [ ] **Step 4: 스크립트·gitignore 커밋과 푸시**

```bash
git add artifacts/qa/status-v2-capture.cjs .gitignore
git commit -m "상태판 v2 QA 캡처 스크립트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin improve/status-board-v2
```

- [ ] **Step 5: PR 생성**

```bash
GIT_CONFIG_NOSYSTEM=1 gh pr create --base main --head improve/status-board-v2 --title "상태판 v2 — 능력 축 카드·지문형 리더보드·Terminal-Bench 4.0·실시간 속도" --body "$(cat <<'BODY'
## 요약

- 상단을 종합·코딩·에이전트·속도·가성비 5칸으로 바꿔 축마다 지금 1위 모델이 바로 보이게 했습니다. 속도·최저가 카드는 뺐습니다.
- 리더보드는 지문형입니다. 종합·코딩·에이전트 세 막대와 강점 라벨(종합·코딩·에이전트·빠름·가성비)로 읽고, 숫자는 TB 4.0·속도·비용·사용량만 남겼습니다. batch·free 변형은 정식 모델 행에 접었습니다.
- Terminal-Bench 4.0 공식 리더보드(tbench.ai)를 수집해 열·패널·코딩 카드 부제에 넣었습니다. 모델 값은 조합 중 최고 하나, 에이전트명은 함께 표시합니다.
- 비어 있던 속도를 OpenRouter 공개 모델 페이지의 제공사별 p50으로 채웠습니다. 요청 수가 가장 많은 표준 경로를 대표값으로 씁니다. 문서화 API는 인증 없이는 null이라 쓰지 않습니다.
- 산점도 세로축이 선택 지표를 따라가고, 종합일 때 가성비 전선을 점선으로 그립니다.
- 스냅샷 스키마 v2. 피드에 이미 있던 AA 코딩·에이전트 지수를 화면에 처음 씁니다.

## 데이터 출처 결정

SWE-bench Verified는 싣지 않았습니다. 공식 리더보드는 2026-02, Epoch AI 자체 실행은 2026-06이 마지막이라 9월 프런티어 모델이 없습니다. 근거는 `docs/status-research.md`.

## 검증

- `npm test`: status 55 + rules 6 + editorial 통과
- `npx tsc --noEmit`, `npm run build`, `npm run test:site` 통과
- Playwright로 Ink·White, 1440·390 캡처 (아래)

## 스크린샷

Ink 1440

![status-ink-1440](https://raw.githubusercontent.com/SEORY0/DADES/qa/status-v2-shots/shots/status-ink-1440.png)

Ink 1440 · 코딩 지표 선택

![status-ink-1440-coding](https://raw.githubusercontent.com/SEORY0/DADES/qa/status-v2-shots/shots/status-ink-1440-coding.png)

Ink 390

![status-ink-390](https://raw.githubusercontent.com/SEORY0/DADES/qa/status-v2-shots/shots/status-ink-390.png)

White 1440

![status-white-1440](https://raw.githubusercontent.com/SEORY0/DADES/qa/status-v2-shots/shots/status-white-1440.png)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```
Expected: PR URL 출력. 본문의 이미지가 렌더되는지 `gh pr view --web` 대신 URL을 브라우저로 열어 확인한다.

- [ ] **Step 6: 계획 체크박스 마무리**

이 문서의 모든 `- [ ]`를 `- [x]`로 바꾸고 커밋한다.

```bash
git add docs/superpowers/plans/2026-09-09-status-board-v2.md
git commit -m "상태판 v2 구현 계획 완료 표시

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

---

## 계획 자체 점검 (작성 시 수행)

- Spec 3.1 flight 분리 → Task 1. 3.2 TB → Task 2·4. 3.3 속도 → Task 3·4. 3.4 스키마 v2 → Task 4·7. 3.5 워크플로 무변경 → 전역 제약. 4.1 접기 → Task 6. 4.2 축 → Task 6·7. 4.3 가성비 → Task 6·7(전선 선). 4.4 강점 → Task 6. 4.5 지문 → Task 6·8·9. 5.1 카드 → Task 8·9. 5.2 2행 → Task 8·9. 5.3 리더보드 → Task 8·9. 5.4 비교 → Task 9. 5.5 출처 → Task 8. 6 결측 → Task 3·4·6·8. 7 검증 → Task 10·11. 8 파일 → File Structure. 9 범위 밖 → 미포함.
- Spec 5.2와 다른 점 하나: Terminal-Bench 패널은 "상위 6행"이 아니라 "모델별 최고 행 하나씩 상위 6개"로 그린다(`terminalRows`). 같은 모델의 추론 강도별 행이 상위를 독차지해 패널이 반복되기 때문이다. spec 5.2 문장을 이 규칙으로 고쳐 둔다.
- 이름 일관성: `metricValue`(문자열, `model-board.ts`) vs `metricNumber`(숫자, 규칙 모듈의 `metricValue` 재수출). `ranked` = 규칙 모듈 `rankBy`. `cardMetrics` 4개 + 가성비 카드는 `data-value-card`. `EMPTY = '–'`.
