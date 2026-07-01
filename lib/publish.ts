// Publish content to the live site. The site reads content straight from the repo
// (content/*, public/media/*) and Vercel redeploys on push — so "publish" is just
// commit + push of those paths. One code path, reused by the daily CLI, the manual
// `bun run publish` script, and the MTTA Studio desktop app.
//
// Everything returns a STRUCTURED result and never throws for the expected failures
// (nothing to commit, push rejected) — the caller (esp. the desktop app) needs the
// raw git stderr to show, not a stack trace. The #1 real failure is push auth on the
// HTTPS remote; that surfaces here as { status:'error', stage:'push', stderr }.
import { execFile } from 'node:child_process';

// Everything the admin editor and the daily flow can write.
export const CONTENT_PATHS = ['content', 'public/media'];

export type PublishStatus = 'ok' | 'nothing-to-commit' | 'error';
export type PublishResult = {
  status: PublishStatus;
  stage?: 'add' | 'commit' | 'push';
  commit?: string;   // short sha, on success
  message?: string;  // the commit message used
  stderr?: string;   // verbatim git stderr, on error
};

type Git = { code: number; stdout: string; stderr: string };

function git(root: string, args: string[]): Promise<Git> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: root, maxBuffer: 1024 * 1024 * 16 }, (err, stdout, stderr) => {
      resolve({ code: err && typeof (err as { code?: number }).code === 'number' ? (err as { code: number }).code : err ? 1 : 0, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

// Which of the given paths have staged/unstaged/untracked changes.
export async function gitStatus(root: string, paths: string[] = CONTENT_PATHS): Promise<{ files: string[] }> {
  const r = await git(root, ['status', '--porcelain', '--', ...paths]);
  const files = r.stdout.split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  return { files };
}

export type PublishOpts = { root: string; message: string; paths?: string[] };

export async function publish({ root, message, paths = CONTENT_PATHS }: PublishOpts): Promise<PublishResult> {
  const add = await git(root, ['add', '--', ...paths]);
  if (add.code !== 0) return { status: 'error', stage: 'add', stderr: add.stderr || add.stdout };

  // Anything staged under these paths? If not, there's nothing to publish.
  const staged = await git(root, ['diff', '--cached', '--name-only', '--', ...paths]);
  if (!staged.stdout.trim()) return { status: 'nothing-to-commit' };

  const commit = await git(root, ['commit', '-m', message]);
  if (commit.code !== 0) return { status: 'error', stage: 'commit', stderr: commit.stderr || commit.stdout };

  const push = await git(root, ['push']);
  if (push.code !== 0) return { status: 'error', stage: 'push', stderr: push.stderr || push.stdout };

  const sha = await git(root, ['rev-parse', '--short', 'HEAD']);
  return { status: 'ok', commit: sha.stdout.trim(), message };
}
