'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';

type Props = {
  open: boolean;
  lines: Line[];
  stations: Station[];
  onClose: () => void;
  onSelect: (id: string) => void;
};

export default function IndexPanel({ open, lines, stations, onClose, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const lineById = useMemo(() => Object.fromEntries(lines.map((l) => [l.id, l])), [lines]);
  const results = useMemo(() => {
    const toks = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return stations
      .filter((s) => (filter ? s.line === filter : true))
      .filter((s) => {
        if (!toks.length) return true;
        const hay = `${s.title} ${lineById[s.line]?.label ?? s.line} ${s.date ?? ''} ${s.body ?? ''}`.toLowerCase();
        return toks.every((t) => hay.includes(t)); // every word must match, across title/line/date/body
      })
      .sort((a, b) => a.line.localeCompare(b.line) || a.title.localeCompare(b.title));
  }, [stations, q, filter, lineById]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="ip-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="ip scroll"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="Station index"
          >
            <div className="ip-head">
              <span className="mono">index · {stations.length} stops</span>
              <button className="ip-x" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <input ref={inputRef} className="ip-search" placeholder="search stops…  (⌘K)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); onSelect(results[0].id); } }} />
            <div className="ip-chips">
              <button className={`chip ${!filter ? 'on' : ''}`} onClick={() => setFilter(null)}>all</button>
              {lines.map((l) => (
                <button key={l.id} className={`chip ${filter === l.id ? 'on' : ''}`} style={filter === l.id ? { background: l.color, borderColor: l.color, color: l.text } : { borderColor: l.color }} onClick={() => setFilter(filter === l.id ? null : l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <ul className="ip-list">
              {results.map((s) => {
                const l = lineById[s.line];
                return (
                  <li key={s.id}>
                    <button className="ip-item" onClick={() => onSelect(s.id)}>
                      <span className="ip-dot" style={{ background: l?.color }} />
                      <span className="ip-t">{s.title}</span>
                      <span className="ip-line mono">{s.line}{s.date ? ` · ${s.date}` : ''}</span>
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && <li className="ip-empty mono">no stops match</li>}
            </ul>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
