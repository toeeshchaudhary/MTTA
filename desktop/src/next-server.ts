// Manage the local Next dev server the studio window points at. Reuse one that's
// already listening on our dedicated port; otherwise spawn `bun run dev --port <port>`
// against the repo. We only ever kill a server WE spawned — never the user's own.
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.MTTA_STUDIO_PORT) || 4300;
// MUST be `localhost` (not 127.0.0.1): Next 16's dev server treats a numeric-IP host
// as a cross-origin dev request and blocks the client chunks unless it's in
// allowedDevOrigins — which silently breaks hydration (the /admin editor loads but
// never fetches content). localhost is same-origin, so the editor hydrates normally.
export const STUDIO_URL = `http://localhost:${PORT}`;

export type Server = { url: string; spawned: boolean; child?: ChildProcess };

// Is something answering HTTP on the port already?
function probe(timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${STUDIO_URL}/`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ensure the server is up; returns how to reach it and whether we own its lifecycle.
export async function ensureServer(repoRoot: string, onLog?: (line: string) => void): Promise<Server> {
  if (await probe()) return { url: STUDIO_URL, spawned: false };

  // Spawn in its own process group so we can kill the whole tree (bun → next → worker).
  const child = spawn('bun', ['run', 'dev', '--port', String(PORT)], {
    cwd: repoRoot,
    env: { ...process.env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => onLog?.(String(d)));
  child.stderr?.on('data', (d) => onLog?.(String(d)));

  // Poll HTTP for readiness (don't parse Next's stdout — its ready line is brittle).
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await probe()) return { url: STUDIO_URL, spawned: true, child };
    if (child.exitCode !== null) throw new Error(`dev server exited early (code ${child.exitCode})`);
    await sleep(500);
  }
  stopServer({ url: STUDIO_URL, spawned: true, child });
  throw new Error('dev server did not become ready within 90s');
}

export function stopServer(server?: Server): void {
  if (!server?.spawned || !server.child?.pid) return;
  try { process.kill(-server.child.pid, 'SIGTERM'); } // negative pid → whole group
  catch { try { server.child.kill('SIGTERM'); } catch { /* already gone */ } }
}
