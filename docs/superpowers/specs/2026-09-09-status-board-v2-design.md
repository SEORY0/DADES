# AI 상태판 v2 설계 — 지금 가장 유용한 모델이 한눈에 보이게

작성 2026-09-09. 대상 경로 `/status/`. 현재 구현은 `src/pages/status.astro`, `src/lib/model-board*.ts`, `scripts/status/*.mjs`, `public/data/model-board.json`.

## 1. 목적과 범위

상태판 하나로 "지금 종합·코딩·에이전트·속도·가성비에서 각각 어떤 모델이 제일인가"를 숫자를 읽지 않고도 알 수 있게 한다. 글자는 지금 수준 이하로 유지하고 글래스 패널 디자인은 그대로 둔다.

바꾸는 것:

- 피드에 이미 있으나 화면에 없던 AA 코딩·에이전트 지수를 표시한다.
- Terminal-Bench 4.0 공식 리더보드를 수집해 열·패널·카드에 넣는다.
- 비어 있던 속도를 OpenRouter 공개 모델 페이지의 제공사별 실시간 p50으로 채운다.
- batch·free 변형 행을 정식 모델 행에 접는다.
- 상단 카드·리더보드·산점도를 "능력 축" 중심으로 재구성한다.

바꾸지 않는 것: nav, 홈, 다른 라우트, 글래스 재질, 30분 갱신 워크플로, 새 의존성 없음 원칙, "합산 점수는 만들지 않는다" 원칙.

## 2. 조사로 확정한 결정

| 결정 | 근거 |
| --- | --- |
| SWE-bench Verified는 넣지 않는다 | 공식 리더보드는 2026-02, Epoch AI 자체 실행은 2026-06이 마지막이라 9월 프런티어 모델이 없다. 벤더 자기보고값만 존재. 출처 설명에 한 문장으로 이유를 적는다. |
| Terminal-Bench 4.0 공식 리더보드(tbench.ai)를 쓴다 | 2026-09-03 갱신, 18행, 95% CI 포함. GPT-6 Astra·Fable 5.1·Opus 5·GLM-5.3 등 최신 모델 포함. AA 코딩 지수 자체가 Terminal-Bench v4.0을 포함한다. |
| 속도는 OpenRouter 공개 모델 페이지를 파싱한다 | 문서화 API의 throughput·latency 필드는 인증 없이는 null. 공개 페이지에는 제공사별 p50 속도·지연·요청 수·창 길이(`window_minutes`)가 임베디드돼 있어 키 없이 읽힌다. 요청 수가 있어 트래픽 기준 대표 제공사를 고를 수 있다. |
| 가격은 지금대로 OpenRouter 카탈로그 | 30분마다 갱신되는 실시간 가격이며 더 나은 공개 출처가 없다. |
| 리더보드는 지문형(B안) | 숫자 대신 세 막대 묶음과 강점 라벨. 숫자는 툴팁·비교 패널에서 본다. |

## 3. 데이터 파이프라인

### 3.1 공통: Next.js flight 파서 분리

`scripts/status/rankings.mjs`의 `publishedRecords`(`self.__next_f.push` 조각을 합쳐 `id:JSON` 레코드 맵으로 만드는 부분)를 `scripts/status/flight.mjs`로 옮기고 rankings·성능·Terminal-Bench 어댑터가 공유한다. 동작은 바뀌지 않는다.

`refresh.mjs`의 `fetchSource`는 허용 호스트를 `openrouter.ai`, `www.tbench.ai` 두 개로 확장한다. 리다이렉트가 요청 호스트를 벗어나면 지금처럼 거부한다. HTML 응답은 요청 URL이 HTML 출처(rankings, 모델 페이지, tbench)일 때만 텍스트로 돌려준다. 응답 상한 8MB 유지.

### 3.2 Terminal-Bench 4.0 어댑터 (`scripts/status/terminal-bench.mjs`)

- URL: `https://www.tbench.ai/leaderboard/terminal-bench/4.0`
- flight 레코드 중 `leaderboard`와 `rows`를 함께 가진 객체를 찾는다. `leaderboard.title`이 `Terminal-Bench`로 시작하고 `leaderboard.name`이 `4-0-0`이 아니면 실패로 처리한다. `rows`가 비어도 실패.
- 행마다 읽는 값: `rank`, `metadata.model_display.label/url`, `metadata.agent_display.label`, `metadata.agent_org.label`, `metadata.model_org.label`, `metadata.reasoning_effort`, `metadata.date`, `metrics.accuracy`(0~100), `metrics.accuracy_ci95_half_width`, `metrics.n_trials`. accuracy가 숫자가 아니거나 범위를 벗어나면 그 행은 실패로 처리한다(추정하지 않는다).
- 모델 매핑(정식 OpenRouter 모델만, `:`·`~` 제외):
  1. `key(s) = s.toLowerCase().replace(/[^a-z0-9]/g, '')`
  2. `model_org.label`을 네임스페이스로 바꾼다: OpenAI→`openai`, Anthropic→`anthropic`, Google→`google`, xAI→`x-ai`, Z.ai→`z-ai`, Moonshot→`moonshotai`. 매핑표에 없으면 네임스페이스 제한 없이 시도한다.
  3. 같은 네임스페이스의 정식 모델 중 `key(modelName)`이 `key(label)`과 같거나 `key(label)`로 끝나는 모델이 정확히 하나면 채택한다.
  4. 0개 또는 2개 이상이면 `config/status.aliases.json`의 `terminalBench` 항목(`{"label": "openrouter/id"}`)을 본다. 거기에도 없으면 미매핑.
- 모델별 값: 매핑된 행 중 accuracy 최고 하나. `terminalBench = { accuracy, ci95, agent, effort, date }`. 나머지 행은 버리지 않고 보드의 TB 목록에 남는다.
- 보드 값: `terminalBench = { title, url, updatedAt, rows }`. `rows`는 순위순 전체(현재 18행)이며 각 행에 `modelId`(매핑 실패 시 null)를 붙인다.
- 출처 노트: 매핑 성공/전체 행 수, 리더보드 `updated_at`, "에이전트·추론 강도별 결과이며 모델 값은 그중 최고 정확도 하나"라는 설명.

### 3.3 속도 어댑터 (`scripts/status/performance.mjs`)

- 샘플 선정은 지금 `performanceSample`과 같다: 정식 모델 중 종합 상위 16 + 사용량 상위 16 + 나머지 채움, 최대 32개.
- 요청 URL은 카탈로그의 `model.url`(`https://openrouter.ai/{id}`).
- flight 레코드에서 `queryKey`가 `["model-page","providerTableEndpointStats",{permaslug, variant:"standard", …}]`인 react-query 항목의 `state.data`(엔드포인트 배열)를 읽는다. 각 엔드포인트의 `model_variant_slug`가 요청한 모델 ID와 같고 `variant === 'standard'`일 때만 후보로 삼는다.
- 후보 조건: `stats.p50_throughput`가 양수, `stats.throughput_request_count ≥ 1`, `is_free`·`is_deranked`·`is_disabled`·`is_hidden`·`is_byok_only`가 모두 false.
- 대표 엔드포인트: `throughput_request_count` 최대 → 동률이면 `p50_throughput` 최대 → 동률이면 `provider_slug` 사전순.
- 저장: `speed = p50_throughput`(tok/s), `latency = p50_latency / 1000`(초, 페이지는 ms), `speedProvider = provider_display_name`, `speedRequests = throughput_request_count`, `speedWindow = window_minutes`.
- 요청은 4개 동시, 15초 타임아웃, 실패 시 1회 재시도. 재시도 후에도 하나라도 실패하면 배치 전체를 버리고 이전 관측을 유지한다(관측 시각이 섞이지 않게).
- 후보가 없는 모델은 null. 샘플 전체가 null이면 출처를 `unavailable`로 두고 이전 값을 유지한다.

### 3.4 스냅샷 스키마 v2

`schemaVersion: 2`. 모델 필드 추가:

| 필드 | 형 | 의미 |
| --- | --- | --- |
| `terminalBench` | `{ accuracy, ci95, agent, effort, date }` 또는 null | 매핑된 TB 4.0 행 중 최고 정확도 |
| `speedRequests` | number 또는 null | 대표 엔드포인트의 최근 창 요청 수 |
| `speedWindow` | number 또는 null | 관측 창 길이(분) |

보드 필드 추가: `terminalBench`(3.2). 출처 목록에 `{ id: 'terminal-bench', label: 'Terminal-Bench 4.0 leaderboard', url }` 추가. `openrouter-performance` 출처의 `url`은 `https://openrouter.ai/` 모델 페이지 설명으로 바꾼다.

`cli.mjs`는 기존 v1 스냅샷을 읽으면 새 필드를 null로 채워 v2로 취급한다. 그 외 형식은 지금처럼 거부한다. 브라우저 zod 스키마도 v2만 받는다.

실패 보존은 지금 `keepFields` 패턴 그대로: TB 필드군(`terminalBench` + 보드 `terminalBench`), 성능 필드군(`speed`, `latency`, `speedProvider`, `speedRequests`, `speedWindow`)을 각각 통째로 유지한다.

### 3.5 워크플로

`.github/workflows/model-board.yml`은 바꾸지 않는다. 한 번의 갱신에서 HTTPS 요청은 카탈로그 1 + 랭킹 1 + TB 1 + 모델 페이지 최대 32(재시도 포함 최대 64)이다.

## 4. 화면 규칙

### 4.1 정식 모델 접기 (`src/lib/model-board.ts`)

- `base(id)`: 앞의 `~`와 `:` 이후를 뗀 ID.
- 같은 base끼리 묶고, `id === base`인 모델을 대표로 삼는다. 없으면 ID가 가장 짧은 것.
- 대표에 `variants: [{ id, kind, inputPrice, outputPrice }]`를 붙인다. `kind`는 `:` 뒤 문자열.
- 표시 값은 대표 모델 것만 쓴다. 변형의 지수·사용량·속도를 대표에 합치지 않는다.
- 변형 칩: `batch`는 대표 대비 출력 단가 할인율이 있으면 `batch −50%`, 없으면 `batch`; `free`는 `free`; 그 외는 kind 그대로. 데스크톱 표의 개발사 옆에만 작게 보인다.
- 사용량 패널은 지금처럼 경로 단위(변형 포함)로 둔다. 리더보드의 사용량 정렬은 대표 모델 값만 본다.

### 4.2 축과 순위

축: `intelligence`(종합), `coding`(코딩), `agentic`(에이전트), `terminalBench`(TB), `speed`(속도), `cost`(1M+1M 비용, 오름차순), `tokens7d`(사용량). `cost`는 `estimate(model, 1, 1)`이다. 순위는 정식 모델 중 값이 있는 것만, 지금 `ranked`와 같은 규칙.

### 4.3 가성비 (Pareto 전선)

- 후보: 종합 지수와 비용이 모두 있는 정식 모델.
- 전선: 자기보다 종합이 높으면서 비용이 같거나 싼 모델, 또는 종합이 같거나 높으면서 더 싼 모델이 없는 후보.
- 가성비 집합: 전선 중 종합 지수가 선두의 80% 이상인 모델에서 종합 1위를 뺀 것.
- 가성비 카드: 집합에서 비용 최저, 동률이면 종합 높은 쪽. 오늘 데이터로는 GLM-5.3 Flash(종합 46.2, $0.33).
- 산점도에 전선(종합 1위 + 가성비 집합)을 잇는 얇은 계단선을 그린다.

### 4.4 강점 라벨

행마다 해당하는 것을 모두, 이 순서로: 종합 · 코딩 · 에이전트 · 빠름 · 가성비.

- 종합·코딩·에이전트: 그 AA 지수 정식 모델 순위 3위 이내.
- 빠름: 속도 순위 3위 이내.
- 가성비: 4.3의 집합에 속함.

라벨은 필 하나에 두 글자 안팎이고 색은 강조 1색만 쓴다. 규칙은 출처 패널에 각 한 줄로 적는다.

### 4.5 지문 막대

종합·코딩·에이전트 세 막대. 높이 = 값 / 그 축 정식 모델 최댓값. 선택 지표의 막대만 강조색, 나머지는 옅은 색. 값이 없는 축은 채움 없이 점선 윤곽만 그린다(0으로 그리지 않는다). 막대 묶음의 `title`과 `aria-label`에 세 숫자를 넣는다.

## 5. 화면 구성 (위에서 아래로)

### 5.1 상단 카드 5칸

종합 1위 · 코딩 1위 · 에이전트 1위 · 속도 1위 · 가성비. 카드 구조(아이콘 아트, 큰 숫자 + 단위, 모델명, 부제)는 지금과 같다.

| 카드 | 큰 숫자 | 부제 |
| --- | --- | --- |
| 종합 1위 | 종합 지수, 단위 AA | 개발사 |
| 코딩 1위 | 코딩 지수, 단위 AA | 그 모델의 TB 4.0 값이 있으면 `Terminal-Bench 4.0 · 57.9%`, 없으면 개발사 |
| 에이전트 1위 | 에이전트 지수, 단위 AA | 개발사 |
| 속도 1위 | tok/s | 대표 제공사명 |
| 가성비 | 1M+1M 비용 `$0.33` | `종합 46.2 · 선두의 81%` |

카드 클릭은 리더보드 지표를 그 축으로 바꾼다. 가성비 카드는 산점도로 스크롤한다. 속도 관측이 하나도 없으면 속도 카드는 숨기고 4칸이 된다. 기존 "최저 출력가" 카드는 없앤다. 기준일 소문은 지금처럼 카드 하단에 둔다.

반응형: 1200px 이상 5열, 810~1199px 3+2, 809px 이하 2열이며 5번째 칸은 두 열을 차지한다.

### 5.2 2행: 산점도 · Terminal-Bench 4.0 · 주간 사용량

- 산점도: 세로축이 리더보드 선택 지표를 따른다(종합·코딩·에이전트만, 그 외 지표에서는 종합 유지). 가로축은 지금처럼 1M+1M 비용 로그 눈금. 세로축이 종합일 때만 4.3의 전선 계단선을 그리고, 코딩·에이전트일 때는 선을 그리지 않는다(전선은 종합 기준으로만 정의한다). 점 선택 판독문은 지금과 같다.
- Terminal-Bench 4.0 패널: 상위 6행. 한 줄에 순위 · 모델명 · 정확도, 아래 줄 작은 글씨로 에이전트명 · 추론 강도. 막대는 사용량 패널과 같은 트랙 스타일. 하단에 리더보드 원문 링크와 `updated_at` 날짜.
- 주간 사용량: 지금 그대로.

열 비율 1.4fr · 1fr · 1fr. 1199px 이하는 산점도 한 줄, 아래 두 패널 나란히. 809px 이하는 세로로 쌓는다.

### 5.3 리더보드 (B안)

지표 스위치: 종합 · 코딩 · 에이전트 · TB · 속도 · 비용 · 사용량. 599px 이하에서는 가로 스크롤되는 필 줄.

데스크톱 열:

| 열 | 내용 |
| --- | --- |
| 순위 | 선택 지표 기준 |
| 모델 | 비교 체크박스 · 모델명(원문 링크) · 개발사 · 변형 칩 |
| 지문 | 4.5 |
| 강점 | 4.4 |
| TB 4.0 | `57.9%`. `title`에 `±2.8 · Claude Code · max · 9/1` |
| 속도 | `59` tok/s, 아래 작은 글씨로 제공사명 |
| 1M+1M | `$60`. `title`에 입력·출력 단가 |
| 사용량 | 주간 tokens compact |

표 최소 폭 960px, 가로 스크롤 유지. 값이 없는 셀은 옅은 색 `–` 하나. 검색·개발사 필터·URL 상태·20개 더 보기·비교 3개 제한은 지금과 같다.

599px 이하: 순위 · 모델 · 지문 · 선택 지표 값 네 열만.

### 5.4 비교 패널

`dl` 항목에 코딩·에이전트 다음에 `Terminal-Bench 4.0 · %`(에이전트명 병기)와 `속도 창 요청 수`를 추가한다. 나머지는 지금과 같다.

### 5.5 출처 패널

- `method-grid` 세 단락을 다시 쓴다: (1) 종합·코딩·에이전트는 AA 지수이며 합산하지 않는다, (2) Terminal-Bench는 에이전트+모델 조합의 결과이고 모델 값은 그중 최고 하나다, SWE-bench Verified는 독립 출처(공식 리더보드 2026-02, Epoch AI 자체 실행 2026-06)가 최신 모델을 다루지 않아 싣지 않는다, (3) 속도는 OpenRouter 모델 페이지의 트래픽 최다 제공사 p50이며 창 길이와 요청 수를 함께 표시한다.
- 강점·가성비 규칙 한 줄씩.
- 출처 목록에 Terminal-Bench 항목 추가. 하단 크레딧에 `Terminal-Bench · Stanford / Harbor / Laude Institute` 추가.

## 6. 결측과 오류

- 값이 없는 셀·막대는 0이 아니라 `–`·점선 윤곽. 순위에는 값이 있는 모델만 들어간다.
- TB 수집 실패: 보드·모델 TB 필드를 이전 값으로 유지하고 출처를 `unavailable`, 노트에 오류 메시지. 이전 값도 없으면 TB 패널은 "공식 리더보드를 확인하지 못했습니다" 한 줄, TB 열·카드 부제·라벨은 비운다.
- TB 미매핑 행: 패널에는 보이고 표에는 붙지 않는다. 노트에 `18행 중 14행 매핑`처럼 적는다.
- 속도 실패: 이전 값 유지, 출처 `unavailable`. 속도가 전혀 없으면 카드 숨김, 열은 `–`, 빠름 라벨 없음.
- 페이지 구조 변경으로 파싱이 실패하면 추정하지 않고 실패로 남긴다(지금 원칙).

## 7. 테스트와 검증

- 픽스처: 오늘 받은 tbench.ai 4.0 페이지와 OpenRouter `anthropic/claude-opus-5` 페이지에서 flight 스크립트만 남긴 축약본을 `tests/fixtures/status/`에 둔다.
- 단위 테스트(`tests/status-data.test.mjs`에 추가): TB 파서·검증·매핑(정확 일치, 접미 일치, 네임스페이스 충돌, 별칭, 미매핑), 속도 파서·후보 조건·대표 선택·재시도·배치 전체 보존, v1→v2 이전, keepFields 확장.
- 화면 규칙 테스트(`tests/model-board-rules.test.mjs` 신설, `src/lib/model-board.ts`를 직접 import): 접기, 축 순위, Pareto 전선·가성비, 강점 라벨, 지문 스케일.
- `tests/site-contract.test.mjs`의 지표 열 목록을 새 축에 맞춘다.
- `npm test`, `npm run test:site`, `npm run build` 통과.
- Playwright(`~/.npm/_npx/e41f203b7505f1fb`, `/usr/bin/google-chrome`)로 1440·390 화면을 White·Ink 테마로 캡처해 PR 본문에 붙인다. 캡처는 `artifacts/qa/status-v2/`에 둔다.
- PR은 `improve/status-board-v2` → `main`.

## 8. 손대는 파일

새 파일: `scripts/status/flight.mjs`, `scripts/status/terminal-bench.mjs`, `scripts/status/performance.mjs`, `config/status.aliases.json`, `src/components/status/TerminalBenchPanel.astro`, `src/components/status/Fingerprint.astro`, `tests/model-board-rules.test.mjs`, `tests/fixtures/status/*.html`.

수정: `scripts/status/rankings.mjs`, `scripts/status/refresh.mjs`, `scripts/status/cli.mjs`, `src/lib/model-board.ts`, `src/lib/model-board-render.ts`, `src/lib/model-board-charts.ts`, `src/lib/model-board-client.ts`, `src/pages/status.astro`, `src/components/status/ModelRow.astro`, `src/components/status/BoardCharts.astro`, `src/styles/model-board.css`, `tests/status-data.test.mjs`, `tests/site-contract.test.mjs`, `docs/status-data.md`, `docs/status-research.md`, `public/data/model-board.json`(갱신 실행 결과).

삭제: `scripts/status/catalog.mjs`의 `parseEndpoint`·`endpointRequests`(문서화 API 경로는 더 쓰지 않는다)와 그 테스트.

## 9. 범위 밖

SWE-bench, Epoch AI 데이터, Artificial Analysis 직접 API, LiteLLM 가격 교차 확인, nav·홈·다른 라우트 변경, 새 npm 의존성, 이미지 생성.
