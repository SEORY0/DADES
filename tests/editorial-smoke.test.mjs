import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { collectCandidates, loadConfig, readPublishedIssues } from '../scripts/editorial/collect.mjs';

test('live collect-only smoke finds or diagnoses allowlisted feeds', { timeout: 45000 }, async () => {
  // Given: the production editorial feed configuration.
  const config = await loadConfig(path.join(process.cwd(), 'config/editorial.sources.json'));
  const published = await readPublishedIssues(path.join(process.cwd(), 'src/content/issues'));

  // When: the collector performs its bounded live RSS pass.
  const result = await collectCandidates({ config, published, now: new Date() });

  // Then: each configured feed reports a deterministic diagnostic and successful feeds stay bounded.
  assert.equal(result.diagnostics.length, config.feeds.length);
  assert.ok(result.diagnostics.some((entry) => entry.status === 'ok'));
  assert.ok(result.candidates.length <= config.collection.maxCandidates);
});
