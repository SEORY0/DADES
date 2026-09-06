#!/usr/bin/env node
import path from 'node:path';
import { draftIssueWithAnthropic } from './anthropic.mjs';
import { collectCandidates, loadConfig, makeIssuePlan, readPublishedIssues } from './collect.mjs';
import { findSourceCover } from './cover.mjs';
import { printSummary, publishIssue, writeArtifacts } from './publish.mjs';
import { toIssueJson, validateDraft } from './schema.mjs';

const ROOT = process.cwd();
const DEFAULT_CONFIG = path.join(ROOT, 'config/editorial.sources.json');
const ISSUES_DIR = path.join(ROOT, 'src/content/issues');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }

  const config = await loadConfig(options.config);
  const published = await readPublishedIssues(ISSUES_DIR);
  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.valueOf())) throw new Error(`Invalid --now value: ${options.now}`);
  const plan = {
    ...makeIssuePlan({ now, maxNumber: published.maxNumber, windowDays: config.collection.windowDays }),
    minItems: config.collection.minItems,
    minOrigins: config.collection.minOrigins,
    maxItems: config.collection.maxItems,
  };
  if (published.dates.has(plan.date)) throw new Error(`An issue already exists for ${plan.date}.`);

  const outputDir = options.outputDir ?? path.join(ROOT, '.editorial/runs', `${plan.date}-issue-${String(plan.number).padStart(3, '0')}`);
  const { candidates, diagnostics } = await collectCandidates({ config, published, now });
  await writeArtifacts({ outputDir, plan, candidates, diagnostics, draft: null, issue: null, quarantineReason: null });
  if (diagnostics.length > 0 && diagnostics.every((entry) => entry.status === 'error')) {
    const message = 'All editorial feeds failed; refusing to produce an empty successful run.';
    await writeArtifacts({ outputDir, plan, candidates, diagnostics, draft: null, issue: null, quarantineReason: message });
    throw new Error(message);
  }

  let draft = null;
  let issue = null;
  let publishedPath = null;
  let quarantineReason = null;

  if (candidates.length === 0) {
    quarantineReason = 'no in-scope fresh candidates';
  } else if (!hasEnoughQuality(candidates, config.collection)) {
    quarantineReason = `insufficient candidates or origins: candidates=${candidates.length}, origins=${new Set(candidates.map((candidate) => candidate.origin)).size}`;
  } else if (!options.collectOnly) {
    try {
      draft = await draftIssueWithAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY, config, candidates, plan });
      const parsed = validateDraft({
        draft,
        candidates,
        published,
        plan,
        quality: { minItems: config.collection.minItems, minOrigins: config.collection.minOrigins },
      });
      issue = toIssueJson(parsed);
      const coverResult = await findSourceCover({ issue });
      diagnostics.push(...coverResult.diagnostics);
      if (coverResult.cover) issue.cover = coverResult.cover;
      if (options.publish) publishedPath = await publishIssue({ issuesDir: ISSUES_DIR, plan, issue });
    } catch (error) {
      await writeArtifacts({ outputDir, plan, candidates, diagnostics, draft, issue, quarantineReason: error.message });
      throw error;
    }
  }

  await writeArtifacts({ outputDir, plan, candidates, diagnostics, draft, issue, quarantineReason });
  printSummary({ plan, candidates, outputDir, publishedPath, quarantineReason });
}

export function parseArgs(args) {
  const options = { config: DEFAULT_CONFIG, publish: false, collectOnly: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--publish') options.publish = true;
    else if (arg === '--collect-only') options.collectOnly = true;
    else if (arg === '--config') options.config = requireValue(args, (index += 1), arg);
    else if (arg === '--output-dir') options.outputDir = requireValue(args, (index += 1), arg);
    else if (arg === '--now') options.now = requireValue(args, (index += 1), arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.publish && options.collectOnly) throw new Error('--publish cannot be combined with --collect-only.');
  return options;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

function helpText() {
  return `DADES editorial pipeline

Usage:
  node scripts/editorial/cli.mjs [--collect-only] [--publish] [--config PATH] [--output-dir DIR] [--now ISO_DATE]

Default mode collects candidates and, when candidates exist, drafts a validated issue with Anthropic.
--collect-only writes only candidates and diagnostics under .editorial/.
--publish atomically writes src/content/issues/issue-NNN.json after validation.
ANTHROPIC_API_KEY is required unless --collect-only is used or no candidates are found.`;
}

function hasEnoughQuality(candidates, collection) {
  const origins = new Set(candidates.map((candidate) => candidate.origin));
  return candidates.length >= collection.minItems && origins.size >= collection.minOrigins;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
