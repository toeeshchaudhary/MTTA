// Client-safe playful-settings types + helpers (no node:fs, so the public map can import
// these without dragging the filesystem reader into the browser bundle). lib/content re-exports.

// Playful, admin-toggleable extras for the public map. All default on except sound.
export type Play = {
  critters: boolean;       // a subway rat scurries the tracks now and then
  stationPulse: boolean;   // stops flash when a train dwells
  expressTrain: boolean;   // a rare express blows through without stopping
  serviceQuips: boolean;   // departures board shows witty transit-flavoured messages
  sounds: boolean;         // door chime / swipe sfx (off by default — needs intent)
  nightOwl: boolean;       // konami-code neon "night owl" easter egg
  quips: string[];         // the pool of service messages (editable)
};

export const PLAY_DEFAULTS: Play = {
  critters: true,
  stationPulse: true,
  expressTrain: true,
  serviceQuips: true,
  sounds: false,
  nightOwl: true,
  quips: [
    'GOOD SERVICE · slowly living',
    'DELAYED · that side project',
    'NOW ARRIVING · a new idea',
    'EXPRESS · skipping the small talk',
    'MIND THE GAP · between plan and ship',
    'NEXT · whatever comes',
  ],
};

// merge a raw (possibly missing/partial) play object onto the defaults
export function normalizePlay(raw: unknown): Play {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    critters: bool(p.critters, PLAY_DEFAULTS.critters),
    stationPulse: bool(p.stationPulse, PLAY_DEFAULTS.stationPulse),
    expressTrain: bool(p.expressTrain, PLAY_DEFAULTS.expressTrain),
    serviceQuips: bool(p.serviceQuips, PLAY_DEFAULTS.serviceQuips),
    sounds: bool(p.sounds, PLAY_DEFAULTS.sounds),
    nightOwl: bool(p.nightOwl, PLAY_DEFAULTS.nightOwl),
    quips: Array.isArray(p.quips) && p.quips.length ? p.quips.map((q) => String(q)).filter(Boolean) : PLAY_DEFAULTS.quips,
  };
}
