// Manage the Next dev server the studio window points at.
//
// Next 16 allows only ONE dev server per repo directory (it records the live one in
// .next/dev/lock and refuses to start a second, even on another port). The user often
// already has `next dev` running — so we REUSE that server (reading its URL from the
// lock) and only spawn our own if none is running. We only ever kill a server WE
// spawned, never the user's.
//
// The window MUST load via `localhost` (not 127.0.0.1): Next treats a numeric-IP host
// as cross-origin in dev and blocks the client chunks, which silently breaks the
// admin editor's hydration.
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';

const PORT = Number(process.env.MTTA_STUDIO_PORT) || 4300;
const OWN_URL = `http://localhost:${PORT}`;

export type Server = { url: string; spawned: boolean; child?: ChildProcess };

// Does an MTTA dev server answer at this base URL? (probe /admin so we don't mistake
// some unrelated server on a common port for ours.)
function probe(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/admin`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// The dev server Next currently has running for this repo, if any.
function lockUrl(repoRoot: string): string | null {
  try {
    const lock = JSON.parse(readFileSync(join(repoRoot, '.next', 'dev', 'lock'), 'utf8'));
    // normalise to localhost (the lock may say 127.0.0.1 / an IP)
    if (typeof lock?.port === 'number') return `http://localhost:${lock.port}`;
    if (typeof lock?.appUrl === 'string') return lock.appUrl.replace(/\/\/[^:]+:/, '//localhost:');
  } catch { /* no lock */ }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ensureServer(repoRoot: string, onLog?: (line: string) => void): Promise<Server> {
  // 1. Reuse a dev server already running for this repo (any port).
  const existing = lockUrl(repoRoot);
  if (existing && (await probe(existing))) return { url: existing, spawned: false };
  // Fallback: our own port might already be up from a previous studio run.
  if (await probe(OWN_URL)) return { url: OWN_URL, spawned: false };

  // 2. None running — spawn our own on the studio port, in its own process group so we
  //    can tear down the whole tree (bun → next → worker).
  const child = spawn('bun', ['run', 'dev', '--port', String(PORT)], {
    cwd: repoRoot,
    env: { ...process.env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => onLog?.(String(d)));
  child.stderr?.on('data', (d) => onLog?.(String(d)));

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await probe(OWN_URL)) return { url: OWN_URL, spawned: true, child };
    // If Next bailed (e.g. a lock race), fall back to whatever it says is running.
    if (child.exitCode !== null) {
      const late = lockUrl(repoRoot);
      if (late && (await probe(late))) return { url: late, spawned: false };
      throw new Error(`dev server exited early (code ${child.exitCode})`);
    }
    await sleep(500);
  }
  stopServer({ url: OWN_URL, spawned: true, child });
  throw new Error('dev server did not become ready within 90s');
}

export function stopServer(server?: Server): void {
  if (!server?.spawned || !server.child?.pid) return;
  try { process.kill(-server.child.pid, 'SIGTERM'); } // negative pid → whole group
  catch { try { server.child.kill('SIGTERM'); } catch { /* already gone */ } }
}
