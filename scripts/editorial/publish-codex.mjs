#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { candidateSchema, validateDraft, toIssueJson } from './schema.mjs';
import { loadConfig, readPublishedIssues, makeIssuePlan } from './collect.mjs';
import { publishIssue } from './publish.mjs';
import { enrichStoryImages } from './story-images.mjs';

// Codex writes the draft after reading the collected primary sources. No model API key.
export async function publishCodexDraft({ root = process.cwd(), runDir, draftFile, now = new Date(), enrich = enrichStoryImages }) {
  const config = await loadConfig(path.join(root, 'config/editorial.sources.json'));
  const issuesDir = path.join(root, 'src/content/issues');
  const published = await readPublishedIssues(issuesDir);
  const plan = makeIssuePlan({ now, maxNumber: published.maxNumber, windowDays: config.collection.windowDays });
  const stored = JSON.parse(await fs.readFile(path.join(runDir, 'diagnostics.json'), 'utf8'));
  if (stored.plan.date !== plan.date || stored.plan.number !== plan.number || published.dates.has(plan.date)) throw new Error('Stale or already published run; collect again.');
  const candidates = JSON.parse(await fs.readFile(path.join(runDir, 'candidates.json'), 'utf8')).map(row => candidateSchema.parse(row));
  const since = now.getTime() - config.collection.windowDays * 86400000;
  if (candidates.some(row => new Date(row.publishedAt).getTime() < since || new Date(row.publishedAt) > now)) throw new Error('Candidates outside the collection window.');
  const draft = JSON.parse(await fs.readFile(draftFile, 'utf8'));
  const parsed = validateDraft({ draft, candidates, published, plan, quality: config.collection });
  if (parsed.items.length > config.collection.maxItems) throw new Error('Too many stories for one briefing.');
  const issue = await enrich(toIssueJson(parsed));
  return publishIssue({ issuesDir, plan, issue });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [runDir, draftFile] = process.argv.slice(2);
  if (!runDir || !draftFile) { console.error('Usage: node scripts/editorial/publish-codex.mjs RUN_DIR DRAFT_JSON'); process.exitCode = 1; }
  else publishCodexDraft({ runDir, draftFile }).then(file => console.log(`published=${file}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
