# Model board data

The board reads `public/data/model-board.json`. Its checked-in snapshot is available without a browser request; the browser can fetch the same-origin JSON to discover a later published snapshot. Browser polling does not query upstream providers or measure inference speed.

## Scope and units

The catalog covers all text-output entries returned by the [public OpenRouter models API](https://openrouter.ai/api/v1/models), including dated models, aliases, free variants, and routing products. It is not a census of the entire AI model market. Published IDs are retained; variants are not silently merged. A truncated or empty catalog is rejected.

| Field | Meaning |
| --- | --- |
| `context` | Published context length in tokens |
| `inputPrice`, `outputPrice` | Base USD per million tokens, converted from the API's per-token price |
| `intelligence`, `coding`, `agentic` | Artificial Analysis indices forwarded in the OpenRouter catalog |
| `speed` | p50 output tokens per second of the standard OpenRouter provider endpoint that served the most requests in the published window |
| `latency` | p50 latency in seconds from the same endpoint (the page publishes milliseconds) |
| `speedRequests`, `speedWindow` | Request count and window length in minutes behind that endpoint's p50 |
| `terminalBench` | Best Terminal-Bench 4.0 accuracy mapped to the model: `{ accuracy, ci95, agent, effort, date }`, or null |
| `tokens7d` | Published trailing seven-day prompt plus completion token volume on OpenRouter |
| `previousTokens7d` | Previous complete seven-day volume, only when directly available |
| `dailyTokens` | Published daily observations, only when directly available |

Prices exclude additional request, image, audio, caching, search, and context-tier charges. A free price is zero; an unavailable or negative sentinel price is null. Displayed base prices are not quotes for every provider endpoint or workload.

Benchmark indices keep their original scale. They are not percentages, are not capped at 100, and are never combined into a DADES score. Their presence in this feed does not establish coverage of every evaluated model or every benchmark release. No Artificial Analysis API key is used.

Direct Artificial Analysis performance ingestion is not enabled. Its [API documentation](https://artificialanalysis.ai/data-api/docs) links [Data Platform Terms v1.1](https://artificialanalysiscdn.com/legal/ProDataPlatformTerms.pdf), revised 2026-08-19 and explicitly covering the Free API. Sections 2.3–2.5 restrict machine-readable redistribution, dashboard embedding, combined datasets, and public ranking/comparison products; attribution alone does not establish permission for publishing those API metrics in this JSON. A future direct adapter would need applicable publication rights and exact model identity mapping. This pipeline currently consumes only the benchmark fields already exposed by the public OpenRouter catalog.

Performance collection reads the public OpenRouter model page (`https://openrouter.ai/{author}/{slug}`) for up to 32 canonical models per refresh: 16 leading intelligence models, 16 leading usage models, then deterministic fill. Aliases and colon-suffixed variants are never sampled. The page embeds a `providerTableEndpointStats` query for the standard variant; each endpoint carries `p50_throughput`, `p50_latency`, `throughput_request_count`, and `window_minutes`. Free, deranked, disabled, hidden, and BYOK-only endpoints are ignored, as are endpoints with no requests or no throughput. The endpoint with the most requests wins; ties go to higher throughput, then provider slug. Requests run four at a time with a 15-second timeout and one retry each. If any sampled page still fails, the whole batch is discarded and the previous batch is retained so that measurements never mix timestamps. The documented `/api/v1/models/{id}/endpoints` route publishes these fields only to authenticated callers, which is why the page is used instead.

Terminal-Bench 4.0 is read from the official leaderboard page (`https://www.tbench.ai/leaderboard/terminal-bench/4.0`), which embeds the leaderboard rows in its Next.js payload. The adapter requires the leaderboard name `4-0-0`, a non-empty row list, and an update time; each row needs a rank, model label, agent label, ISO date, and accuracy between 0 and 100. Rows are agent-plus-model combinations. Each row is mapped to a canonical OpenRouter model by normalising the label (lowercase alphanumerics) and matching it exactly or as a suffix of the catalog display name inside the organisation's namespace; ambiguous or unmatched labels fall back to `config/status.aliases.json`. A model keeps its best mapped accuracy with the agent, reasoning effort, 95% CI half-width, and run date. All rows, including unmapped ones, are stored in `terminalBench.rows` for the board panel. SWE-bench Verified is not collected: the official leaderboard stopped receiving frontier entries in February 2026 and Epoch AI's own runs end in June 2026, so neither covers current models.

Usage is taken from the published [OpenRouter rankings page](https://openrouter.ai/rankings). Its totals describe visible traffic routed through OpenRouter, excluding requests kept private. They do not count unique people, requests, provider-direct traffic, or spending. The scraper requires recognizable published data; a page format change makes this source unavailable rather than creating an estimate. Missing history remains empty, and a percentage change is never reverse-engineered into a previous total.

The adapter follows the page's `initialRanking.rankingData` reference and requires both `rankingType: week` and the referenced query's `view: week`. It maps routes using the page's model links or an exact, unambiguous catalog canonical ID plus variant. This published subset currently contains 20 rows; other catalog models have unknown usage. Usage `observedAt` is the last reported UTC bucket date, while `fetchedAt` records when DADES requested the data. The live snapshot generated on 2026-09-09 contains 429 catalog entries, 128 intelligence observations, 20 weekly usage totals, 18 Terminal-Bench rows (18 mapped), and 32 sampled models with provider throughput.

## Refresh and failure behavior

Run from the repository with Node 22:

```sh
node scripts/status/cli.mjs
node --test tests/status-data.test.mjs
```

Terminal-Bench label aliases live in config/status.aliases.json; the refresh reads it when present.

No new packages or API credentials are required. The script fetches catalog and rankings independently, then samples performance. It atomically replaces the JSON only after assembling a usable snapshot. If the first catalog request fails and no prior snapshot exists, it exits unsuccessfully and writes nothing.

`fetchedAt` records the refresh attempt time. Each source has its own `status`, `observedAt`, and explanation. A failed source retains its last successful field values and its earlier source timestamp. Other sources may still update. A missing optional observation is represented by null, never zero. An unavailable performance batch is retained as a whole so that a mixture of old and new measurements does not acquire one misleading fresh timestamp. Failed benchmark collection similarly preserves earlier indices. An existing snapshot with an unreadable or unsupported format is not overwritten.

The `model-board.yml` workflow requests a refresh at minutes 7 and 37 each hour on `main`, then builds the site, stages only `public/data/model-board.json`, pushes without force, and dispatches the existing Pages deployment workflow. GitHub's scheduler and Pages delivery can be delayed, so this is an intended 30-minute collection interval rather than a freshness guarantee. Upstream measurements can be older still; use their source timestamps and notes.

This change prepares the workflow locally. It does not push the branch, enable repository Actions, activate the schedule, or deploy Pages. Scheduled operation begins only after the workflow is present on the repository's default `main` branch and GitHub permits its write and Actions permissions. No personal access token or vendor key is required; the workflow uses GitHub's scoped job token.

If a concurrent commit makes the push fail, rerun the refresh workflow from the new `main`; there is no automatic force push. If the snapshot push succeeded but the deployment dispatch failed, rerun only `gh workflow run deploy.yml --ref main` to publish the committed snapshot. Branch protection can require adapting this automation to a repository-approved pull-request flow.

## Schema

The JSON has `schemaVersion: 2`, `fetchedAt`, `sources`, `terminalBench`, and `models`. `terminalBench` is `{ title, url, updatedAt, rows }` or null; each row is `{ rank, model, modelUrl, agent, agentOrg, modelOrg, effort, accuracy, ci95, date, trials, modelId }`. A version 1 file is upgraded in memory on the next refresh by adding null `terminalBench`, `speedRequests`, and `speedWindow` fields. Every numeric model property is a finite nonnegative number or null. Every model includes every schema field, with `dailyTokens` defaulting to an empty array. A source is `ok` only when its current adapter yields usable observations; otherwise it is `unavailable` with a retained prior timestamp or null. The source notes state coverage limits and any retained data.
