// Safe bridge from the /admin web page to the main process. The native menu drives
// Publish/Daily today; this exposes the same actions to an in-page button (Phase 3)
// without enabling nodeIntegration.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('studio', {
  publish: () => ipcRenderer.invoke('studio:publish'),
  daily: (photos: string[], note?: string) => ipcRenderer.invoke('studio:daily', { photos, note }),
  status: () => ipcRenderer.invoke('studio:status'),
});
