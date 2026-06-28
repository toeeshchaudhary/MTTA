// Terrain = water, Mini-Metro style. One kind only: flat light-blue bodies of any shape,
// drawn freely with the pen. No harbours/rivers/parks/blocks — just water.
// Plain module (no 'use client') so it's safe to import on the server too.
import type { Pt } from '@/content/lines';

export type TerrainKind = 'water';

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
  coast: string;   // the lighter "current" line just inside the bank
  icon: string;
  round: number;   // corner radius when drawn as a bare rectangle (no points)
  smooth: boolean; // water is always organic
  water: boolean;  // crossable → auto-bridges
};

export const TERRAIN_KINDS: TerrainKindDef[] = [
  { id: 'water', label: 'water', fill: 'var(--water, #bfe2f1)', line: 'var(--water-line, #97cbe3)', coast: 'var(--water-coast, #e4f4fc)', icon: '≈', round: 26, smooth: true, water: true },
];

// Any saved feature (whatever its old kind string) renders as water now.
const WATER = TERRAIN_KINDS[0];
export const KIND_BY_ID: Record<string, TerrainKindDef> = new Proxy(
  { water: WATER },
  { get: () => WATER },
);
