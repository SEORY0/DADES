#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lastSuccess } from './refresh.mjs';

const snapshotPath = fileURLToPath(new URL('../../public/data/model-board.json', import.meta.url));

// A source that keeps failing must turn the workflow red instead of quietly serving old values.
export function staleSources(snapshot, { now = new Date(), maxAgeHours = 24 } = {}) {
  return snapshot.sources.flatMap((source) => {
    const last = lastSuccess(source, snapshot);
    const ageHours = last ? (now.getTime() - new Date(last).getTime()) / 3_600_000 : Infinity;
    return ageHours > maxAgeHours ? [{ id: source.id, status: source.status, lastSuccessAt: last, ageHours, note: source.note }] : [];
  });
}

function parseArgs(args) {
  if (args.length === 0) return { maxAgeHours: 24 };
  if (args.length === 2 && args[0] === '--max-age-hours' && Number(args[1]) > 0) return { maxAgeHours: Number(args[1]) };
  throw new Error('Usage: node scripts/status/check.mjs [--max-age-hours N]');
}

async function main() {
  const { maxAgeHours } = parseArgs(process.argv.slice(2));
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  const stale = staleSources(snapshot, { maxAgeHours });
  for (const source of snapshot.sources) {
    const entry = stale.find((item) => item.id === source.id);
    console.log(`${entry ? 'STALE' : 'ok   '} ${source.id.padEnd(24)} last success ${lastSuccess(source, snapshot) ?? 'never'}`);
  }
  if (!stale.length) return;
  for (const source of stale) {
    const age = Number.isFinite(source.ageHours) ? `${Math.round(source.ageHours)}h` : 'ever';
    console.log(`::error title=Stale model board source::${source.id} has not refreshed for ${age} (limit ${maxAgeHours}h). ${source.note}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Status check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
