import fs from 'node:fs/promises';
import path from 'node:path';

export async function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tmpPath, body, { flag: 'wx' });
  try {
    await fs.link(tmpPath, filePath);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

export async function writeArtifacts({ outputDir, plan, candidates, diagnostics, draft, issue, quarantineReason }) {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'candidates.json'), `${JSON.stringify(candidates, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, 'diagnostics.json'), `${JSON.stringify({ plan, diagnostics, quarantineReason }, null, 2)}\n`);
  if (draft) await fs.writeFile(path.join(outputDir, 'draft.raw.json'), `${JSON.stringify(draft, null, 2)}\n`);
  if (issue) await fs.writeFile(path.join(outputDir, 'issue.validated.json'), `${JSON.stringify(issue, null, 2)}\n`);
}

export async function publishIssue({ issuesDir, plan, issue }) {
  const filePath = path.join(issuesDir, plan.filename);
  try {
    await writeJsonAtomic(filePath, issue);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`${filePath} already exists; refusing to overwrite an issue.`);
    throw error;
  }
  return filePath;
}

export function printSummary({ plan, candidates, outputDir, publishedPath, quarantineReason }) {
  const lines = [
    `issue=${plan.number}`,
    `date=${plan.date}`,
    `candidates=${candidates.length}`,
    `artifacts=${outputDir}`,
  ];
  if (publishedPath) lines.push(`published=${publishedPath}`);
  if (quarantineReason) lines.push(`quarantine=${quarantineReason}`);
  console.log(lines.join('\n'));
}
