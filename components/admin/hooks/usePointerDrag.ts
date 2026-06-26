// Window-level drag boilerplate, in one place. Each drag effect supplies its own
// move/up bodies; this attaches the listeners and returns the cleanup. Replaces the
// six-plus near-identical addEventListener/removeEventListener blocks in the editor.
export function onDrag(move: (e: PointerEvent) => void, up: (e: PointerEvent) => void): () => void {
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  return () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
}
