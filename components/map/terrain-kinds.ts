// Terrain, Wyman-map style: flat light-blue water bodies and pale-green parks,
// drawn freely with the pen. Plain module (no 'use client') so it's safe to
// import on the server too.
import type { Pt } from '@/content/lines';

export type TerrainKind = 'water' | 'park';

export type TerrainFeature = {
  id: string;
  kind: TerrainKind;
  // bounding box — kept in sync with `points` (bounds/label/bridge-fallback use it)
  x: number;
  y: number;
  w: number;
  h: number;
  // the shape: a polygon of map-space points. Optional for back-compat (renders as its bbox).
  points?: Pt[];
  // corner radius for the rigid polygon: 0 = sharp corners, higher = rounder. undefined → DEFAULT_ROUND.
  round?: number;
  label?: string;
};

// default corner radius for water bodies (map units) — used when a feature has no explicit `round`.
export const DEFAULT_ROUND = 16;

export type TerrainKindDef = {
  id: TerrainKind;
  label: string;
  fill: string;    // flat body colour
  line: string;    // crisp outer bank
  coast?: string;  // the lighter "current" line just inside the bank (water only)
  icon: string;
  round: number;   // corner radius when drawn as a bare rectangle (no points)
  smooth: boolean; // organic coastline
  water: boolean;  // crossable → auto-bridges
};

export const TERRAIN_KINDS: TerrainKindDef[] = [
  { id: 'water', label: 'water', fill: 'var(--water, #bfe2f1)', line: 'var(--water-line, #97cbe3)', coast: 'var(--water-coast, #e4f4fc)', icon: '≈', round: 26, smooth: true, water: true },
  { id: 'park', label: 'park', fill: 'var(--park, #cfe3c0)', line: 'var(--park-line, #b0cf9c)', icon: '❀', round: 26, smooth: true, water: false },
];

export const KIND_BY_ID: Record<string, TerrainKindDef> = Object.fromEntries(TERRAIN_KINDS.map((k) => [k.id, k]));
// Resolve a feature's kind; legacy kind strings from old saves ('river', 'block', …)
// fall back to water — same behaviour the old catch-all Proxy provided.
export const kindOf = (f: { kind: string }): TerrainKindDef => KIND_BY_ID[f.kind] ?? KIND_BY_ID.water;
