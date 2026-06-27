// Static editor configuration — tools, palettes, grid metrics.
import type { Pin, Tool } from '@/components/admin/types';

export const TOOLS: { id: Tool; key: string; icon: string; label: string; hint: string }[] = [
  { id: 'select', key: 'v', icon: '✥', label: 'select', hint: 'click a stop to edit/drag · click a thread then drag its dots to curve & re-route · drag empty space to pan' },
  { id: 'station', key: 's', icon: '◉', label: 'place stop', hint: 'tap the map to drop a new stop · stops sitting on more than one thread become joint stations' },
  { id: 'track', key: 't', icon: '╱', label: 'lay track', hint: 'tap to add track points · finish to make a thread' },
  { id: 'paint', key: 'p', icon: '▦', label: 'paint', hint: 'click a line or stop to recolour its thread' },
  { id: 'terrain', key: 'r', icon: '⛰', label: 'terrain', hint: 'pick land below · tap the map to drop points, tap the first point to close · drag a piece to move, drag its points to reshape' },
  { id: 'note', key: 'n', icon: '✦', label: 'note', hint: 'pick note/photo below · drag (or tap) the map to pin it · drag to move, grab a corner to resize' },
  { id: 'bulldoze', key: 'x', icon: '✕', label: 'bulldoze', hint: 'click a stop, line, land or pin to delete it' },
];

export const PIN_KINDS: { id: Pin['kind']; label: string }[] = [{ id: 'note', label: 'note' }, { id: 'photo', label: 'photo' }];
export const SHAPES = ['circle', 'square', 'triangle', 'semi'];
export const PALETTE = ['#e3000b', '#0d47a1', '#ffcf00', '#1f8a4c', '#141414', '#ff6319', '#00add0', '#b933ad'];

export const GRID = 20;
export const FAR = 20000; // half-size of the "infinite" paper/hit surface
// editor chrome ink — resolves per theme (see --ed-ink in globals.css)
export const INK = 'var(--ed-ink)';
