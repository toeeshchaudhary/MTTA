// Single source of truth for the "lines" of the site. Each section is a line
// with an MTA-style route bullet + color. Used by the map, page chrome, nav,
// and station lists so everything stays in sync.

export type ServiceState = 'good' | 'work' | 'delay';

export type Line = {
  /** route bullet glyph, e.g. "A", "7", "N" */
  bullet: string;
  /** human label */
  label: string;
  /** url */
  href: string;
  /** CSS color (an MTA route color) */
  color: string;
  /** bullet text color (yellow lines use dark text) */
  text: string;
  /** one-line description, signage voice */
  blurb: string;
  /** terminus name, shown as the train's destination */
  dest: string;
  /** current service state for the status board */
  status: ServiceState;
};

export const LINES: Record<string, Line> = {
  home: {
    bullet: 'S',
    label: 'home',
    href: '/',
    color: 'var(--mta-shuttle)',
    text: '#fff',
    blurb: 'the interchange — who, why, everything',
    dest: 'Grand Central · everything',
    status: 'good',
  },
  writing: {
    bullet: '1',
    label: 'writing',
    href: '/writing',
    color: 'var(--mta-red)',
    text: '#fff',
    blurb: 'rants, notes, things half-thought',
    dest: 'to the end of the thought',
    status: 'good',
  },
  projects: {
    bullet: '7',
    label: 'projects',
    href: '/projects',
    color: 'var(--mta-purple)',
    text: '#fff',
    blurb: 'things built & under construction',
    dest: 'under construction',
    status: 'work',
  },
  likes: {
    bullet: 'N',
    label: 'likes',
    href: '/likes',
    color: 'var(--mta-yellow)',
    text: '#111',
    blurb: 'music, films, the good stuff',
    dest: 'the good stuff',
    status: 'good',
  },
  now: {
    bullet: 'N',
    label: 'now',
    href: '/now',
    color: 'var(--mta-yellow)',
    text: '#111',
    blurb: 'current obsessions — service board',
    dest: 'right now',
    status: 'good',
  },
};

// order shown in the top nav (home omitted — it's the wordmark)
export const NAV: Line[] = [LINES.writing, LINES.projects, LINES.likes, LINES.now];
