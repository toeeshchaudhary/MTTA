'use client';
// Apply a theme with an iris reveal. Uses the View Transitions API (Chromium/most
// modern browsers) so the whole page — map, panels, tiles — wipes from one palette to
// the other as a circle expanding from the toggle. Falls back to an instant swap where
// unsupported or when the user prefers reduced motion / has the site's MOTION toggle off.
export function applyTheme(next: 'dark' | 'light', origin?: { x: number; y: number }): void {
  const root = document.documentElement;
  const swap = () => {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noMotion = root.classList.contains('no-motion');
  const start = (document as unknown as { startViewTransition?: (cb: () => void) => void }).startViewTransition;
  if (start && !reduce && !noMotion) {
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
