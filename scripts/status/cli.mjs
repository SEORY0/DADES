#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSnapshot } from './refresh.mjs';

const outputPath = fileURLToPath(new URL('../../public/data/model-board.json', import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/status/cli.mjs\nRefresh public/data/model-board.json from public OpenRouter sources. No API key is required.');
    return;
  }
  if (args.length) throw new Error(`Unknown argument: ${args[0]}`);
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(outputPath, 'utf8'));
    if (previous.schemaVersion !== 1 || !Array.isArray(previous.models) || !Array.isArray(previous.sources)) throw new Error('Existing status snapshot has an unsupported format.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const snapshot = await refreshSnapshot({ previous });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, outputPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
  console.log(JSON.stringify({ fetchedAt: snapshot.fetchedAt, models: snapshot.models.length, sources: snapshot.sources.map(({ id, status, observedAt }) => ({ id, status, observedAt })) }, null, 2));
}

main().catch((error) => {
  console.error(`Status refresh failed: ${error.message}`);
  process.exitCode = 1;
});
