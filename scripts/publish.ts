#!/usr/bin/env bun
// Publish pending content changes to the live site (commit + push → Vercel redeploys).
//
//   bun run publish                       # commits content/ + public/media/, pushes
//   bun run publish --message "new stop"  # custom commit message
//   bun run publish --dry                 # just show what would be published
//
// Thin wrapper over lib/publish.ts so the CLI, the daily tool, and the desktop app
// all share one git path. Exits non-zero on error (so the desktop app can detect it).
import { publish, gitStatus, type PublishResult } from '../lib/publish.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const root = process.cwd();

const { files } = await gitStatus(root);
if (!files.length) {
  console.log('nothing to publish — content is already up to date');
  process.exit(0);
}

console.log(`will publish ${files.length} change${files.length > 1 ? 's' : ''}:`);
for (const f of files.slice(0, 20)) console.log(`  ${f}`);
if (files.length > 20) console.log(`  …and ${files.length - 20} more`);

if (flag('dry')) process.exit(0);

const today = new Date();
const dateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const message = arg('message') ?? `content: publish ${dateISO}`;

const res: PublishResult = await publish({ root, message });
if (res.status === 'nothing-to-commit') {
  console.log('nothing to publish');
  process.exit(0);
}
if (res.status === 'error') {
  console.error(`\n✗ publish failed at "${res.stage}":\n${res.stderr}`);
  process.exit(1);
}
console.log(`\n✓ published ${res.commit} — Vercel will redeploy shortly`);
