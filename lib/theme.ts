'use client';
// Apply a theme with a subtle crossfade. Uses the View Transitions API (Chromium/most
// modern browsers) so the whole page — map, panels, tiles — dissolves from one palette
// to the other in one motion. Falls back to an instant swap where unsupported or when
// the user prefers reduced motion / has the site's MOTION toggle off.
export function applyTheme(next: 'dark' | 'light'): void {
  const swap = () => {
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noMotion = document.documentElement.classList.contains('no-motion');
  const start = (document as unknown as { startViewTransition?: (cb: () => void) => void }).startViewTransition;
  if (start && !reduce && !noMotion) start.call(document, swap);
  else swap();
}
