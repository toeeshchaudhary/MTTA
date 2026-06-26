// Terrain palette shared by the public map + the admin builder.
// Plain module (no 'use client') so it's safe to import on the server too.

export type TerrainKind = 'water' | 'park' | 'forest' | 'sand' | 'block';

export type TerrainFeature = {
  id: string;
  kind: TerrainKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export const TERRAIN_KINDS: { id: TerrainKind; label: string; fill: string; stroke: string; icon: string; round: number }[] = [
  { id: 'water', label: 'water', fill: 'var(--water, #c3d6d8)', stroke: 'rgba(20,20,20,0.10)', icon: '≈', round: 22 },
  { id: 'park', label: 'park', fill: 'var(--park, #cdd8b6)', stroke: 'rgba(20,20,20,0.10)', icon: '♣', round: 16 },
  { id: 'forest', label: 'forest', fill: 'var(--forest, #aebf93)', stroke: 'rgba(20,20,20,0.10)', icon: '▲', round: 16 },
  { id: 'sand', label: 'sand', fill: 'var(--sand, #e7dcc1)', stroke: 'rgba(20,20,20,0.08)', icon: '·', round: 20 },
  { id: 'block', label: 'block', fill: 'rgba(20,20,20,0.06)', stroke: 'rgba(20,20,20,0.05)', icon: '▦', round: 4 },
];

export const KIND_BY_ID: Record<string, (typeof TERRAIN_KINDS)[number]> =
  Object.fromEntries(TERRAIN_KINDS.map((k) => [k.id, k]));
