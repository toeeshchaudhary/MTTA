// Shared editor types for the admin dashboard.
import type { Pt } from '@/content/lines';

export type Media = { type: 'audio' | 'image' | 'video'; src: string; caption?: string };
export type St = { id: string; title: string; line: string; lines?: string[]; date?: string; shape: string; x: number; y: number; media: Media[]; body: string };
export type Ln = { id: string; label: string; color: string; text: string; shape: string; blurb: string; d: string; pts?: Pt[]; under?: number[] };
export type Pin = { id: string; kind: 'note' | 'photo'; x: number; y: number; w: number; h: number; tag?: string; text?: string; src?: string; caption?: string };
export type AboutLink = { label: string; url: string };
export type PlayMeta = { critters: boolean; stationPulse: boolean; expressTrain: boolean; serviceQuips: boolean; sounds: boolean; nightOwl: boolean; quips: string[] };
export type SiteMeta = { originLabel: string; originCue: string; about: { name: string; role: string; blurb: string; links: AboutLink[] }; play: PlayMeta };
export type Rect = { x: number; y: number; w: number; h: number };
export type Tool = 'select' | 'station' | 'track' | 'paint' | 'terrain' | 'note' | 'bulldoze';
// undo/redo snapshot — covers every editable slice (history used to drop terrain/pins/site)
export type Snapshot = { lines: Ln[]; stations: St[]; terrain: import('@/components/map/terrain-kinds').TerrainFeature[]; pins: Pin[]; site: SiteMeta; origin: Pt };
