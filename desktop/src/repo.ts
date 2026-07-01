// Where is the MTTA repo checkout? Everything the app does (run the Next server,
// git publish) operates on the real working tree — NOT a bundled copy — so we must
// resolve and validate that path. Resolution order: env → saved config → default → ask.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const CONFIG_DIR = join(homedir(), '.config', 'mtta-studio');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_REPO = join(homedir(), 'Documents', 'life');

// A directory is the MTTA repo iff it has the content + a matching package.json name.
export function isRepo(dir: string): boolean {
  try {
    if (!existsSync(join(dir, 'content', 'lines.json'))) return false;
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return pkg?.name === 'toeesh-network';
  } catch {
    return false;
  }
}

function readConfig(): { repoPath?: string } {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

export function saveRepoPath(repoPath: string): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ repoPath }, null, 2));
}

// Best guess without prompting. Returns null if nothing valid is found (caller asks).
export function resolveRepo(): string | null {
  const candidates = [process.env.MTTA_REPO, readConfig().repoPath, DEFAULT_REPO].filter(Boolean) as string[];
  for (const c of candidates) if (isRepo(c)) return c;
  return null;
}
