'use client';
// Apply a theme with an iris reveal. Uses the View Transitions API (Chromium/most
// modern browsers) so the whole page — map, panels, tiles — wipes from one palette to
// the other as a circle expanding from the toggle. Gated by the in-app MOTION toggle
// (the .no-motion freeze), NOT prefers-reduced-motion — same call the trains make, so a
// motion-averse OS setting doesn't silently kill the reveal. Falls back to an instant
// swap when MOTION is off or the browser lacks View Transitions.
export function applyTheme(next: 'dark' | 'light', origin?: { x: number; y: number }): void {
  const root = document.documentElement;
  const swap = () => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };
  const noMotion = root.classList.contains('no-motion');
  const start = (document as unknown as { startViewTransition?: (cb: () => void) => void }).startViewTransition;
  if (start && !noMotion) {
    // seed the iris centre + radius so the reveal expands from the toggle and always
    // reaches the farthest corner (see @keyframes vt-iris in globals.css)
    if (origin) {
      const r = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
      root.style.setProperty('--vt-x', `${origin.x}px`);
      root.style.setProperty('--vt-y', `${origin.y}px`);
      root.style.setProperty('--vt-r', `${Math.ceil(r)}px`);
    } else {
      root.style.removeProperty('--vt-x'); root.style.removeProperty('--vt-y'); root.style.removeProperty('--vt-r');
    }
    start.call(document, swap);
  } else swap();
}
