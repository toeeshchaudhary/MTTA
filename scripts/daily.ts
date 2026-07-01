#!/usr/bin/env bun
// Push a day's notes to the map. Snaps the given photo into the daily line.
//
//   bun run daily <photo> [options]
//   bun run daily ~/notes.jpg --note "shipped the parser today" --push
//
// Options:
//   --note "..."      markdown body for the stop (default: "Notes from <date>.")
//   --title "..."     stop title (default: the formatted date, e.g. "Jul 1, 2026")
//   --caption "..."   caption under the photo
//   --date YYYY-MM-DD backdate the entry (default: today)
//   --push            git add + commit + push (triggers a Vercel redeploy)
//
// The image is auto-oriented, downscaled to <=1600px, and compressed to jpg.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createDailyEntry, formatDate } from '../lib/daily.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const photo = process.argv[2];
if (!photo || photo.startsWith('--')) {
  console.error('usage: bun run daily <photo> [--note "..."] [--title "..."] [--caption "..."] [--date YYYY-MM-DD] [--push]');
  process.exit(1);
}
if (!fs.existsSync(photo)) {
  console.error(`✗ no such file: ${photo}`);
  process.exit(1);
}

const today = new Date();
const dateISO = arg('date') ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
  console.error(`✗ bad --date "${dateISO}" (want YYYY-MM-DD)`);
  process.exit(1);
}

const ROOT = process.cwd();
const MEDIA_DIR = path.join(ROOT, 'public', 'media', 'daily');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
const outName = `${dateISO}.jpg`;
const outPath = path.join(MEDIA_DIR, outName);
const imageSrc = `/media/daily/${outName}`;

// Optimize into place (auto-orient fixes phone EXIF rotation; only shrinks if larger).
try {
  execFileSync('magick', [photo, '-auto-orient', '-resize', '1600x1600>', '-quality', '82', outPath]);
} catch {
  // magick missing/failed — fall back to a raw copy so the entry still lands.
  fs.copyFileSync(photo, outPath);
  console.warn('! magick unavailable — copied the photo without optimizing');
}

const res = createDailyEntry({
  dateISO,
  title: arg('title'),
  note: arg('note'),
  caption: arg('caption'),
  imageSrc,
});

console.log(`${res.updated ? '↻ updated' : '✓ added'} daily stop  ${formatDate(dateISO)}  (day ${res.count})`);
console.log(`  station: content/stations/${res.id}.md`);
console.log(`  photo:   public${imageSrc}`);
console.log(`  page:    /s/${res.id}`);

if (flag('push')) {
  const msg = `daily: ${dateISO}`;
  execFileSync('git', ['add', 'content/stations', 'content/lines.json', 'public/media/daily'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', msg], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['push'], { cwd: ROOT, stdio: 'inherit' });
  console.log('→ pushed; Vercel will redeploy shortly');
} else {
  console.log('  (not pushed — add --push to publish, or commit yourself)');
}
