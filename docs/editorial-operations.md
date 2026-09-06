# DADES Editorial Operations

The automated editorial pipeline builds a weekly Korean DADES issue from allowlisted RSS and Atom sources. It does not read inboxes, email, GitHub issues, or arbitrary web pages. Source text is treated as untrusted data, and the model is only asked to write short grounded summaries from the collected candidates.

## Local Commands

- Dry-run collection only: `node scripts/editorial/cli.mjs --collect-only`
- Draft and validate without publishing: `ANTHROPIC_API_KEY=... node scripts/editorial/cli.mjs`
- Publish locally after validation: `ANTHROPIC_API_KEY=... node scripts/editorial/cli.mjs --publish`
- Help: `node scripts/editorial/cli.mjs --help`

Artifacts are written outside Astro content under `.editorial/runs/<date>-issue-NNN/`:

- `candidates.json`: raw bounded candidates after freshness, scope, and published URL dedupe.
- `diagnostics.json`: feed-level success/failure counts and quarantine reason.
- `draft.raw.json`: raw model JSON, when a model call happens.
- `issue.validated.json`: content-ready issue JSON before publish.

Only `--publish` writes `src/content/issues/issue-NNN.json`, and that write is atomic. Existing issue files are never overwritten.

## GitHub Activation

Add this repository secret:

- `ANTHROPIC_API_KEY`: Anthropic API key used by the Messages API.

Add this repository variable only when scheduled auto-publishing should be live:

- `EDITORIAL_AUTOPUBLISH=true`

Without that variable, the weekly schedule stays collect-only. Manual `workflow_dispatch` also defaults to dry-run; set the `publish` input to true for a manual publish run.

## Schedule

The workflow runs at `20 23 * * 4` UTC, which is Friday 08:20 KST. The workflow uses one `editorial` concurrency group so overlapping runs do not race issue numbers.

## Failure And Retry

Feed failures are recorded in diagnostics. If enough fresh in-scope candidates remain, drafting can continue; if there are no candidates, the run is quarantined without calling Anthropic. If a non-dry run has candidates but `ANTHROPIC_API_KEY` is missing, the CLI fails clearly instead of generating filler.

Quality gates require 3 to 8 items and at least 2 origins. Candidate collection round-robins across origins before applying the cap, so one noisy source cannot crowd out the whole issue. The validator rejects duplicate published URLs, duplicate IDs, model-invented URLs, changed candidate source metadata, wrong issue numbers, and duplicate publication dates. Future-dated feed entries, malformed item dates, generic non-AI security posts, and non-HTTPS item URLs are skipped before the model sees them. If all feeds fail, the run exits nonzero and preserves diagnostics.

To retry a collection/model/build failure before the issue commit was pushed, download the `editorial-<run_id>-<attempt>` artifact from the workflow run, inspect diagnostics, fix the cause, then rerun. Artifacts are preserved on success or failure for 7 days.

If the issue commit is already on `main` but deployment dispatch failed, run the existing **Deploy DADES to GitHub Pages** workflow (`deploy.yml`) on `main` directly, or use `gh workflow run deploy.yml --ref main`. Do not rerun editorial for the same date: duplicate-date protection deliberately refuses a second issue. If protected-branch policy rejects the bot push, the generated issue remains in the uploaded artifact; resolve the repository publishing permissions before retrying.

## CI And Deployment

The editorial workflow runs the offline editorial tests, builds the current site, runs the CLI, and builds again when publishing. When a new issue JSON is committed, the workflow pushes that commit and dispatches the existing Pages deploy workflow. This explicit dispatch is needed because a `GITHUB_TOKEN` push does not trigger the normal push-based deploy workflow.

Recommended package scripts:

```json
{
  "editorial:dry-run": "node scripts/editorial/cli.mjs --collect-only",
  "editorial:publish": "node scripts/editorial/cli.mjs --publish",
  "test:editorial": "node --test tests/editorial.test.mjs tests/editorial-cover.test.mjs",
  "test:editorial:smoke": "node --test tests/editorial-smoke.test.mjs"
}
```

## Bounds and verification limits

The model receives at most 18 candidates, each with a feed excerpt capped to 700 characters, and one 2,200-token output call. It has no browsing or execution tools. Source URLs and metadata are checked against those candidates; this is not a guarantee that every generated factual sentence is true. Full article bodies are not collected. A missing or unclear excerpt should be omitted by the editor, and source links remain visible to readers.

The default model is a configurable pinned model name in `config/editorial.sources.json`; confirm availability for the API account before enabling auto-publish. The schedule is best effort: GitHub Actions may delay or disable inactive scheduled workflows. This repository is a static publication: email delivery requires a separate newsletter provider.


## 원문 커버 이미지

검증된 호의 기사 URL 최대 3개에서 원문 OG/Twitter 대표 이미지 메타데이터를 조회한다. HTML 크기·시간·리다이렉트·공개 HTTPS 주소를 제한하고, 실제 원문 URL과 크레딧을 cover에 기록한다. 이미지 조회 실패는 발행을 중단하지 않는다. 원문 이미지가 없으면 갤러리는 제목만 표시하고, 관련 없는 기본 사진이나 생성 이미지는 쓰지 않는다. 외부 이미지가 삭제되면 브라우저는 제목만 남긴다.

현재 예시 호는 원문에서 확인한 이미지를 `src/assets/source-covers/`에 보관하고 Astro가 WebP를 만든다. 자동 발행의 이미지 URL은 원문 제공자의 호스트를 사용한다. `cover.sourceUrl`과 `cover.credit`은 상세 페이지의 이미지 출처로 표시한다. 원본 링크와 출처의 이용 조건은 [이미지 출처 기록](gallery-images.md)에 정리했다.
