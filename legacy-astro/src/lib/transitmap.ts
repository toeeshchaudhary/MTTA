// Hand-laid transit map for the homepage — authored to read like the real NYC
// map: FAT colored ribbons running in tight parallel bundles, crossing at a
// central interchange. Curated, not auto-generated. Colors from lib/lines.ts.
// Grid 0 0 1200 820. Two fat bundles (a vertical trunk + a horizontal trunk)
// weave at the HOME interchange; section stations sit on their colored ribbon.

export const MAP_VIEWBOX = '0 0 1200 820';
export const RIBBON = 24; // ribbon stroke width (fat, like image 3)

export type MapLine = { id: string; color: string; d: string; width?: number };

// vertical trunk x-positions (left→right), 30px apart = tight 6px gap
const VX = { orange: 232, red: 262, green: 292, blue: 322, purple: 352 };
// horizontal trunk y-positions (top→bottom)
const HY = { yellow: 372, teal: 402, brown: 432, gray: 462, lime: 492 };
const TOP = 40, LEFT = 64, RIGHT = 1156;

// The vertical trunk sweeps into a big rounded corner near the bottom and runs
// right along the base — nested concentric arcs (the iconic transit-map move).
// Corner center C; ribbon i keeps spacing by turning on its own radius ρ = Cx − x.
const Cx = 412, Cy = 560;
const corner = (vx: number, color: string, id: string): MapLine => {
  const r = Cx - vx; // radius preserves parallel spacing through the turn
  return { id, color, d: `M${vx},${TOP} L${vx},${Cy} A${r},${r} 0 0 0 ${Cx},${Cy + r} L${RIGHT},${Cy + r}` };
};
// resulting bottom-run y per ribbon (Cy + r): orange 740, red 710, green 680, blue 650, purple 620
export const BOTTOM_Y = {
  orange: Cy + (Cx - VX.orange),
  red: Cy + (Cx - VX.red),
  green: Cy + (Cx - VX.green),
  blue: Cy + (Cx - VX.blue),
  purple: Cy + (Cx - VX.purple),
};

export const MAP_LINES: MapLine[] = [
  // vertical trunk → sweeps right along the bottom
  corner(VX.orange, 'var(--mta-orange)', 'B'),
  corner(VX.red, 'var(--mta-red)', '1'), // writing
  corner(VX.green, 'var(--mta-green)', '4'),
  corner(VX.blue, 'var(--mta-blue)', 'A'),
  corner(VX.purple, 'var(--mta-purple)', '7'), // projects

  // horizontal trunk (full width) — drawn after, so it weaves over at crossings
  { id: 'N', color: 'var(--mta-yellow)', d: `M${LEFT},${HY.yellow} L${RIGHT},${HY.yellow}` }, // likes/now
  { id: 'T', color: 'var(--mta-teal)', d: `M${LEFT},${HY.teal} L${RIGHT},${HY.teal}` },
  { id: 'J', color: 'var(--mta-brown)', d: `M${LEFT},${HY.brown} L${RIGHT},${HY.brown}` },
  { id: 'L', color: 'var(--mta-gray)', d: `M${LEFT},${HY.gray} L${RIGHT},${HY.gray}` },
  { id: 'G', color: 'var(--mta-lime)', d: `M${LEFT},${HY.lime} L${RIGHT},${HY.lime}` },
];

export type MapBullet = { glyph: string; color: string; text?: string };
export type MapStation = {
  x: number;
  y: number;
  kind: 'interchange' | 'station' | 'dot';
  section?: string;
  label?: string;
  bullets?: MapBullet[];
  anchor?: 'start' | 'end' | 'middle';
};

export const MAP_STATIONS: MapStation[] = [
  // HOME — the big interchange at the heart of the weave
  { x: VX.green, y: HY.brown, kind: 'interchange', section: 'home', label: 'home', anchor: 'start' },

  // section stations on their colored ribbon
  { x: VX.red, y: 152, kind: 'station', section: 'writing', label: 'writing', anchor: 'start' },
  { x: 880, y: BOTTOM_Y.purple, kind: 'station', section: 'projects', label: 'projects', anchor: 'middle' },
  { x: 640, y: HY.yellow, kind: 'station', section: 'likes', label: 'likes', anchor: 'middle' },
  { x: 1000, y: HY.yellow, kind: 'station', section: 'now', label: 'now', anchor: 'middle' },

  // express dots (texture along the trunks)
  { x: VX.red, y: 300, kind: 'dot' },
  { x: VX.orange, y: 470, kind: 'dot' },
  { x: 560, y: BOTTOM_Y.green, kind: 'dot' },
  { x: 470, y: HY.teal, kind: 'dot' },
  { x: 1080, y: BOTTOM_Y.red, kind: 'dot' },

  // Girls' Last Tour easter-egg tablets on the scenery ribbons (right end)
  { x: 1100, y: HY.lime, kind: 'station', label: 'End of the Line', anchor: 'end', bullets: [{ glyph: 'G', color: 'var(--mta-lime)', text: '#111' }] },
  { x: 760, y: HY.gray, kind: 'station', label: 'Spiral City', anchor: 'middle', bullets: [{ glyph: 'L', color: 'var(--mta-gray)', text: '#111' }] },
];
