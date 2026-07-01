#!/usr/bin/env bun
// Push a day's notes to the map. Snaps the given photo into the daily line.
//
//   bun run daily <photo...> [options]
//   bun run daily ~/notes.jpg --note "shipped the parser today" --push
//   bun run daily page1.jpg page2.jpg --note-file ~/today.md   # multi-page day
//
// Options:
//   --note "..."      markdown body for the stop (default: "Notes from <date>.")
//   --note-file PATH  read the body from a file (wins over --note; good for long text)
//   --title "..."     stop title (default: the formatted date, e.g. "Jul 1, 2026")
//   --caption "..."   caption for a single photo (multi-page days auto-caption "page N")
//   --date YYYY-MM-DD backdate the entry (default: today)
//   --push            git add + commit + push (triggers a Vercel redeploy)
//
// Each photo is auto-oriented, downscaled to <=1600px, and compressed to jpg.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createDailyEntry, formatDate, type DailyImage } from '../lib/daily.ts';
import { publish } from '../lib/publish.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// Positional args (the photos) come first, before any --flag.
const photos: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) break;
  photos.push(process.argv[i]);
}
if (!photos.length) {
  console.error('usage: bun run daily <photo...> [--note "..."] [--note-file PATH] [--title "..."] [--caption "..."] [--date YYYY-MM-DD] [--push]');
  process.exit(1);
}
for (const p of photos) {
  if (!fs.existsSync(p)) { console.error(`✗ no such file: ${p}`); process.exit(1); }
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

// Optimize each page into place (auto-orient fixes phone EXIF rotation; only shrinks if larger).
const multi = photos.length > 1;
const images: DailyImage[] = photos.map((src, i) => {
  const name = multi ? `${dateISO}-p${i + 1}.jpg` : `${dateISO}.jpg`;
  const outPath = path.join(MEDIA_DIR, name);
  try {
    execFileSync('magick', [src, '-auto-orient', '-resize', '1600x1600>', '-quality', '82', outPath]);
  } catch {
    fs.copyFileSync(src, outPath);
    console.warn(`! magick unavailable — copied ${src} without optimizing`);
  }
  const caption = multi ? `page ${i + 1}` : arg('caption');
  return { src: `/media/daily/${name}`, ...(caption ? { caption } : {}) };
});

const noteFile = arg('note-file');
const note = noteFile ? fs.readFileSync(noteFile, 'utf8') : arg('note');

const res = createDailyEntry({
  dateISO,
  title: arg('title'),
  note,
  images,
});

console.log(`${res.updated ? '↻ updated' : '✓ added'} daily stop  ${formatDate(dateISO)}  (day ${res.count}, ${images.length} photo${images.length > 1 ? 's' : ''})`);
console.log(`  station: content/stations/${res.id}.md`);
for (const im of images) console.log(`  photo:   public${im.src}`);
console.log(`  page:    /s/${res.id}`);

if (flag('push')) {
  const r = await publish({ root: ROOT, message: `daily: ${dateISO}` });
  if (r.status === 'ok') console.log(`→ published ${r.commit}; Vercel will redeploy shortly`);
  else if (r.status === 'nothing-to-commit') console.log('→ nothing new to push');
  else { console.error(`✗ push failed at "${r.stage}":\n${r.stderr}`); process.exit(1); }
} else {
  console.log('  (not pushed — add --push to publish, or commit yourself)');
}
