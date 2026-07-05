// MTTA Studio — a thin native shell around the /admin editor. It runs the Next server
// from the repo checkout, shows /admin in a window, and adds native Publish + Quick
// Daily Note actions that shell out to the repo's bun scripts.
import { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeImage } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveRepo, isRepo, saveRepoPath } from './repo';
import { ensureServer, stopServer, type Server } from './next-server';
import { publishPreview, publishRun, dailyRun } from './actions';

let repoRoot = '';
let server: Server | undefined;
let win: BrowserWindow | null = null;

// ---- repo selection ---------------------------------------------------------
async function pickRepo(): Promise<string | null> {
  const found = resolveRepo();
  if (found) return found;
  const r = await dialog.showOpenDialog({
    title: 'Locate your MTTA repo',
    message: 'Pick the toeesh.network repo folder (contains content/ and package.json).',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  if (!isRepo(r.filePaths[0])) {
    dialog.showErrorBox('Not the MTTA repo', `${r.filePaths[0]} doesn't look like the toeesh.network checkout.`);
    return pickRepo();
  }
  saveRepoPath(r.filePaths[0]);
  return r.filePaths[0];
}

// ---- window -----------------------------------------------------------------
function createWindow(url: string) {
  const iconPath = join(__dirname, '..', 'build', 'icon.png');
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#fcfcfb',
    title: 'MTTA Studio',
    icon: existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(`${url}/admin`);
  win.on('page-title-updated', (e) => e.preventDefault()); // keep "MTTA Studio" in the taskbar
  // Open target=_blank / external links in the system browser, not a new Electron window.
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith(server?.url ?? '')) return { action: 'allow' };
    shell.openExternal(u);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}

// ---- actions ----------------------------------------------------------------
function busy(on: boolean, label = 'Working') {
  if (win) win.setTitle(on ? `MTTA Studio — ${label}…` : 'MTTA Studio');
}

async function doPublish() {
  if (!win) return;
  busy(true, 'Checking');
  const preview = await publishPreview(repoRoot);
  busy(false);
  if (/nothing to publish/i.test(preview.stdout)) {
    await dialog.showMessageBox(win, { type: 'info', message: 'Nothing to publish', detail: 'The live site already matches your local content.', buttons: ['OK'] });
    return;
  }
  const confirm = await dialog.showMessageBox(win, {
    type: 'question',
    message: 'Publish to the live site?',
    detail: `${preview.stdout.trim()}\n\nThis commits + pushes → Vercel redeploys.`,
    buttons: ['Publish…', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });
  if (confirm.response !== 0) return;

  // Let the user customise the commit message (optional — leave blank for the default).
  const msgBox = await dialog.showInputBox
    ? (dialog as unknown as { showInputBox(opts: { title: string; label: string; value: string }): Promise<{ canceled: boolean; value: string }> }).showInputBox({ title: 'Commit message', label: 'Leave blank for default', value: '' })
    : { canceled: false, value: '' };
  const customMsg = msgBox && !msgBox.canceled ? msgBox.value.trim() : '';

  busy(true, 'Publishing');
  const res = await publishRun(repoRoot, customMsg || undefined);
  busy(false);
  if (res.code === 0) {
    await dialog.showMessageBox(win, { type: 'info', message: 'Published ✓', detail: `${res.stdout.trim()}\n\nVercel will redeploy shortly.`, buttons: ['OK'] });
  } else {
    await dialog.showMessageBox(win, { type: 'error', message: 'Publish failed', detail: (res.stderr || res.stdout || 'Unknown git error').trim(), buttons: ['OK'] });
  }
}

async function doDaily() {
  if (!win) return;
  const pick = await dialog.showOpenDialog(win, {
    title: 'Quick Daily Note — pick photo(s) of today’s notes',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'heic', 'webp'] }],
  });
  if (pick.canceled || !pick.filePaths.length) return;

  busy(true, 'Adding daily note');
  const res = await dailyRun(repoRoot, pick.filePaths);
  busy(false);
  if (res.code === 0) {
    win.webContents.reload();
    await dialog.showMessageBox(win, { type: 'info', message: 'Daily note added ✓', detail: `${res.stdout.trim()}\n\nReview it on the map, then hit Publish to put it live.`, buttons: ['OK'] });
  } else {
    await dialog.showMessageBox(win, { type: 'error', message: 'Couldn’t add daily note', detail: (res.stderr || res.stdout).trim(), buttons: ['OK'] });
  }
}

function doAbout() {
  const pkg = (() => { try { return JSON.parse(require('fs').readFileSync(join(repoRoot, 'package.json'), 'utf8')); } catch { return {}; } })();
  dialog.showMessageBox({ type: 'info', title: 'About MTTA Studio', message: 'MTTA Studio', detail: `Local authoring shell for toeesh.network\n\nRepo: ${repoRoot}\nNext.js: ${pkg.dependencies?.next ?? '?'}\nServer: ${server?.url ?? 'not running'}`, buttons: ['OK'] });
}

// ---- menu -------------------------------------------------------------------
function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Studio',
      submenu: [
        { label: 'Publish…', accelerator: 'CmdOrCtrl+P', click: doPublish },
        { label: 'Quick Daily Note…', accelerator: 'CmdOrCtrl+D', click: doDaily },
        { type: 'separator' },
        { label: 'Open the map', click: () => win?.loadURL(`${server?.url}/`) },
        { label: 'Reload admin', accelerator: 'CmdOrCtrl+Shift+R', click: () => win?.loadURL(`${server?.url}/admin`) },
        { type: 'separator' },
        { label: 'About MTTA Studio', click: doAbout },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// ---- ipc (for the in-page bridge, Phase 3) ----------------------------------
ipcMain.handle('studio:publish', doPublish);
ipcMain.handle('studio:daily', async (_e, { photos, note }: { photos: string[]; note?: string }) => dailyRun(repoRoot, photos, note));
ipcMain.handle('studio:status', () => ({ repoRoot, url: server?.url }));
ipcMain.handle('studio:reload', () => win?.loadURL(`${server?.url}/admin`));

// ---- boot -------------------------------------------------------------------
async function boot() {
  const found = await pickRepo();
  if (!found) { app.quit(); return; }
  repoRoot = found;
  try {
    server = await ensureServer(repoRoot, (l) => process.stdout.write(l));
  } catch (e) {
    dialog.showErrorBox('Could not start the studio server', String((e as Error).message ?? e));
    app.quit();
    return;
  }
  buildMenu();
  createWindow(server.url);
}

app.whenReady().then(boot);
app.on('activate', () => { if (!win && server) createWindow(server.url); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => stopServer(server));
