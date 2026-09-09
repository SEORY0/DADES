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
