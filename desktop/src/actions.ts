// Content mutations run as `bun` subprocesses against the repo (cwd = repoRoot), so
// they share the exact code path as the CLI (scripts/publish.ts, scripts/daily.ts)
// and always resolve content relative to the real working tree. Never import repo TS
// into the Electron main process — that would break cwd + transpile assumptions.
import { spawn } from 'node:child_process';

export type Run = { code: number; stdout: string; stderr: string };

function runBun(repoRoot: string, args: string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn('bun', args, { cwd: repoRoot, env: { ...process.env } });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => resolve({ code: 127, stdout, stderr: stderr + String(e) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

// Dry-run: what would publishing commit right now?
export const publishPreview = (repoRoot: string) =>
  runBun(repoRoot, ['scripts/publish.ts', '--dry']);

// Commit + push content → Vercel redeploys. stderr carries git failures verbatim.
export const publishRun = (repoRoot: string, message?: string) =>
  runBun(repoRoot, ['scripts/publish.ts', ...(message ? ['--message', message] : [])]);

// Create a daily stop from one or more photos (does not push — user reviews, then Publishes).
export const dailyRun = (repoRoot: string, photos: string[], note?: string) =>
  runBun(repoRoot, ['scripts/daily.ts', ...photos, ...(note ? ['--note', note] : [])]);
