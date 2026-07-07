// Injects the licensed RM Neue VF fonts at build time.
//
// The .ttf files are NOT committed to this (public) repo — CoType Foundry's EULA
// forbids redistributing the raw font files. Instead they live in a private repo
// (toeeshchaudhary/rm-neue-fonts) and are downloaded here during the build using a
// read-only token in the FONT_REPO_TOKEN env var.
//
// Local dev: if you already have the fonts in public/fonts/ (gitignored), this is a
// no-op. A random clone without the token simply falls back to the CSS fallback stack.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const REPO = 'toeeshchaudhary/rm-neue-fonts';
const FILES = ['RMNeueVF-Regular.ttf', 'RMNeueVF-Italic.ttf'];
const OUT_DIR = join(process.cwd(), 'public', 'fonts');

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  const token = process.env.FONT_REPO_TOKEN;

  const missing = [];
  for (const f of FILES) {
    if (!(await exists(join(OUT_DIR, f)))) missing.push(f);
  }
  if (missing.length === 0) {
    console.log('[fetch-fonts] RM Neue already present, skipping.');
    return;
  }
  if (!token) {
    console.warn(
      '[fetch-fonts] FONT_REPO_TOKEN not set and fonts missing — ' +
      'the site will use the fallback font stack. Set FONT_REPO_TOKEN to embed RM Neue.'
    );
    return; // never fail the build
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const f of missing) {
    const url = `https://api.github.com/repos/${REPO}/contents/fonts/${f}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw',
        'User-Agent': 'fetch-fonts',
      },
    });
    if (!res.ok) {
      console.warn(`[fetch-fonts] could not fetch ${f} (HTTP ${res.status}); using fallback.`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(OUT_DIR, f), buf);
    console.log(`[fetch-fonts] wrote public/fonts/${f} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.warn('[fetch-fonts] non-fatal error:', err?.message ?? err);
});
