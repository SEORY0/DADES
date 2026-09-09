# Model board data

The board renders `public/data/model-board.json` at build time and polls the same-origin file for published updates. Browser polling never queries upstream providers or measures inference speed. Schema version: **3**.

## Sources

| Data | Primary source | Meaning |
| --- | --- | --- |
| Intelligence | [AA model leaderboard](https://artificialanalysis.ai/leaderboards/models) | Artificial Analysis Intelligence Index (AAII), measured scores only |
| Coding | [AA Coding Agent leaderboard](https://artificialanalysis.ai/agents/coding-agents) | Coding Agent Index, a model plus harness and reasoning configuration |
| Agentic | AA model leaderboard | The agentic subset from the same evaluation configuration selected for AAII |
| Prices and context | [OpenRouter catalog](https://openrouter.ai/api/v1/models) | Base USD per million input/output tokens and context length |
| Speed and latency | Public OpenRouter model pages | Standard endpoint with the most requests; p50 throughput and latency |
| Usage | [OpenRouter weekly rankings](https://openrouter.ai/rankings) | Published trailing-week prompt plus completion tokens |
| Terminal-Bench | [Official 4.0 leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/4.0) | Best published model/harness accuracy, with confidence interval and date |

AA data comes directly from JSON embedded in public leaderboard pages. The authenticated AA Data API is not used. Original source links and attribution remain visible. Upstream data remains subject to its source's terms; the collector does not confer redistribution rights.

## Evaluation identity and coverage

The base catalog consists of OpenRouter text-output routes. It is not the complete AA model universe. Benchmark coverage is explicitly limited to models that can be matched to this catalog. Aliases and free/batch routes are folded into canonical model rows for display.

`artificial-analysis.mjs` parses public React JSON records without executing scripts. AAII reads the complete `models` array. Coding reads the full `benchmarkRows` array, including referenced records, rather than the shorter highlight-card array. Missing versions, unresolved references, duplicate identities and empty measured datasets fail the source update.

AAII rows marked as estimated are excluded. Coding observations must have all three evaluation components and a usable endpoint. Coding's published 0–1 index is converted to its displayed 0–100 scale. No OpenRouter-provided benchmark scores are imported.

Mapping prefers AA's exact `openrouterApiId`, then an exact normalized model name within the same creator. It strips configuration parentheses and the Claude name prefix but does not use fuzzy substring matching. Ambiguous matches remain absent. Explicit exceptions can be added in `config/status.aliases.json`: `intelligence` maps AA slugs to catalog IDs; `coding` maps AA evaluation IDs to catalog IDs; `terminalBench` maps published labels to catalog IDs.

For each model, the highest measured AAII configuration supplies both its intelligence/agentic scores and its `aaIntelligence` metadata. Independently, the highest complete coding-agent configuration supplies the coding score and `aaCoding` metadata. Its harness, name, index version, task cost and execution time remain together. The comparison panel exposes both configurations; they must not be interpreted as the same run.

Each AA source stores its index version and collection timestamp. Collection time is not benchmark execution time. Changes in index versions can change scores; small score differences do not establish significant superiority. The headline uses '선두' rather than declaring an absolute best model.

## Costs and visualization

The table's `cost` remains the OpenRouter tariff for one million input plus one million output tokens. The configurable calculator also uses these tariffs. They exclude additional request, image/audio, cache, search and context-tier charges.

The performance/cost chart uses **measured AA cost per task**, not token tariffs. Intelligence uses `aaIntelligence.costPerTask`; coding uses `aaCoding.costPerTask`. Agentic and non-axis filters show the intelligence cost chart because there is no separately measured task cost for the agentic subset. Points without a corresponding measured cost are excluded. Scores and costs always come from the same selected configuration.

The value card selects the lowest AAII task cost among the non-dominated models scoring at least 75% of the observed intelligence leader. Only that pick receives the value label. This is a documented editorial rule, not an AA-issued award. No tariff ceiling or fabricated cost is used. The chart separately shows the full performance/cost frontier.

Score bars show raw numbers and independently normalized lengths for each axis. Missing values have a dash and dashed track. Numbers, labels and fixed positions preserve meaning without color. Model comparison appears after selecting a model.

## Refresh, failures and migration

Run `npm run status:refresh` and `npm run test:status`. No new package or API key is required. The CLI writes an atomic replacement only after building a usable snapshot. A first run without a usable catalog fails rather than publishing an empty board.

Catalog, AAII, coding-agent, usage and Terminal-Bench requests run independently. Performance samples up to 32 canonical models, four concurrent requests at a time, using a 15-second timeout and one retry per model page. Free, deranked, disabled, hidden and BYOK-only endpoints are excluded. A failed performance batch is retained as a whole.

A failed source preserves its own previous fields, version and observation timestamp while other sources may refresh. It is marked unavailable and the page shows '일부 이전 관측'. A failed direct AA source never falls back to OpenRouter's benchmark fields. Valid new AA batches clear unmatched prior values rather than mixing index versions. Missing usage history is never inferred from a percentage change.

Schema v1/v2 migration preserves catalog, speed, usage and available Terminal-Bench fields, but clears legacy benchmark values and their indirect AA source. It initializes `aaIntelligence` and `aaCoding` to null until direct observations are collected. Unsupported future schema versions are rejected.

The scheduled workflow runs at minutes 7 and 37, tests the entire status pipeline, refreshes and builds, then commits only the snapshot and requests Pages deployment. Scheduler delays and source outages are possible. A rejected concurrent push must be retried from current main; no force push is used.

## Snapshot fields

Top level: `schemaVersion`, `fetchedAt`, `sources`, `terminalBench`, `models`.

Each model retains identity, context, token prices, three score values, performance/usage fields and optional `terminalBench`, plus nullable `aaIntelligence` and `aaCoding` objects. AA objects record their source evaluation ID, full configuration name, creator, version, source URL and task cost. Intelligence metadata additionally includes the AA slug and direct mapping ID; coding includes the harness, score and wall time. Sources record status, version where relevant, observation time and a coverage/failure note. Null means unavailable, never zero.
