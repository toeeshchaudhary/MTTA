// The "daily" line — one stop a day. Each entry is a normal station (its own page,
// boarding pass, drawer) that carries a photo of that day's notes. The daily line
// departs from the origin and grows one stop downward each day.
//
// This module is the storage-agnostic core: it turns a { date, note, image } into
// content files. The laptop CLI (scripts/daily.ts) calls it directly. A future
// phone/API flow can save the image to a blob store, then call createDailyEntry()
// with the resulting public URL — same layout logic, different image sink.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = process.cwd();
const STATION_DIR = path.join(ROOT, 'content', 'stations');
const LINES_FILE = path.join(ROOT, 'content', 'lines.json');
const SITE_FILE = path.join(ROOT, 'content', 'site.json');

export const DAILY_LINE_ID = 'daily';

// Layout: a vertical column on the right side of the board, fed from the origin.
const COLUMN_X = 1120;   // x of the daily column (clear of existing content, ~920 max)
const FIRST_Y = 200;     // y of the first day's stop
const SPACING = 88;      // vertical gap between consecutive days

type Pt = [number, number];
type LineObj = {
  id: string; label: string; color: string; text: string;
  shape: string; blurb: string; pts: Pt[]; under?: number[]; d?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return dateISO;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function readOrigin(): Pt {
  try {
    const s = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'));
    if (Array.isArray(s.origin) && s.origin.length === 2) return [Number(s.origin[0]), Number(s.origin[1])];
  } catch {}
  return [700, 96];
}

function loadLines(): LineObj[] {
  try { const a = JSON.parse(fs.readFileSync(LINES_FILE, 'utf8')); if (Array.isArray(a)) return a; } catch {}
  return [];
}
function saveLines(lines: LineObj[]) {
  fs.writeFileSync(LINES_FILE, JSON.stringify(lines, null, 2) + '\n');
}

type DailyStation = { id: string; file: string; date: string; data: Record<string, unknown>; body: string };

function listDailyStations(): DailyStation[] {
  if (!fs.existsSync(STATION_DIR)) return [];
  return fs.readdirSync(STATION_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = path.join(STATION_DIR, f);
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      return { id: f.replace(/\.md$/, ''), file, date: String(data.date ?? ''), data, body: content };
    })
    .filter((s) => s.data.line === DAILY_LINE_ID)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type DailyInput = {
  dateISO: string;     // YYYY-MM-DD
  title?: string;      // defaults to the formatted date
  note?: string;       // markdown body
  imageSrc: string;    // public path already saved, e.g. /media/daily/2026-07-01.jpg
  caption?: string;    // caption under the photo
};

export type DailyResult = { id: string; file: string; x: number; y: number; updated: boolean; count: number };

// Create (or update, if the date already exists) a daily stop, then re-flow the
// whole column so days sit in date order and the line reaches the newest stop.
export function createDailyEntry(input: DailyInput): DailyResult {
  fs.mkdirSync(STATION_DIR, { recursive: true });
  const id = `${DAILY_LINE_ID}-${input.dateISO}`;
  const file = path.join(STATION_DIR, `${id}.md`);
  const updated = fs.existsSync(file);

  const title = (input.title || '').trim() || formatDate(input.dateISO);
  const media = [{ type: 'image', src: input.imageSrc, ...(input.caption ? { caption: input.caption } : {}) }];
  const body = (input.note || '').trim() || `Notes from ${formatDate(input.dateISO)}.`;

  // x/y are placeholders here; relayoutDaily() assigns the real column position.
  const md = matter.stringify(`\n${body}\n`, {
    title, line: DAILY_LINE_ID, lines: [DAILY_LINE_ID],
    date: input.dateISO, shape: 'square', x: COLUMN_X, y: FIRST_Y, media,
  });
  fs.writeFileSync(file, md);

  const stops = relayoutDaily();
  const me = stops.find((s) => s.id === id)!;
  return { id, file, x: COLUMN_X, y: me.y, updated, count: stops.length };
}

// Re-flow every daily stop down the column in date order, and rebuild the daily
// line so it departs the origin and terminates at the newest stop. Idempotent:
// unchanged positions produce no diff.
function relayoutDaily(): { id: string; y: number }[] {
  const stops = listDailyStations();
  const positioned = stops.map((s, i) => ({ ...s, x: COLUMN_X, y: FIRST_Y + SPACING * i }));

  // Persist each station's column position (only rewrites when x/y actually change).
  for (const s of positioned) {
    if (Number(s.data.x) === s.x && Number(s.data.y) === s.y) continue;
    const next = { ...s.data, x: s.x, y: s.y };
    fs.writeFileSync(s.file, matter.stringify(`\n${s.body.trim()}\n`, next));
  }

  const origin = readOrigin();
  const corner: Pt = [COLUMN_X, origin[1]];
  const lastY = positioned.length ? positioned[positioned.length - 1].y : FIRST_Y;
  const pts: Pt[] = [origin, corner, [COLUMN_X, lastY]];

  const lines = loadLines();
  const idx = lines.findIndex((l) => l.id === DAILY_LINE_ID);
  if (idx === -1) {
    lines.push({
      id: DAILY_LINE_ID, label: 'daily', color: '#d98e04', text: '#fff',
      shape: 'square', blurb: 'one stop a day — a photo of the day’s notes', pts,
    });
  } else {
    lines[idx] = { ...lines[idx], pts };
  }
  saveLines(lines);

  return positioned.map((s) => ({ id: s.id, y: s.y }));
}
