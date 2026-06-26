'use client';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export default function VoiceMemo({ src, caption }: { src: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const w = WaveSurfer.create({
      container: ref.current,
      url: src,
      height: 56,
      waveColor: '#9a988f',
      progressColor: '#e3000b',
      cursorColor: '#141414',
      barWidth: 3,
      barGap: 2,
      barRadius: 1,
    });
    ws.current = w;
    w.on('ready', () => setDur(w.getDuration()));
    w.on('timeupdate', (t) => setTime(t));
    w.on('finish', () => setPlaying(false));
    return () => { w.destroy(); ws.current = null; };
  }, [src]);

  const toggle = () => {
    const w = ws.current;
    if (!w) return;
    w.playPause();
    setPlaying(w.isPlaying());
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="vm">
      <button className="vm-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <span className="pause" /> : <span className="play" />}
      </button>
      <div className="vm-body">
        <div className="vm-top"><span className="mono">voice memo</span><span className="vm-time">{fmt(time)} / {fmt(dur)}</span></div>
        <div ref={ref} className="vm-wave" />
        {caption && <div className="vm-cap">{caption}</div>}
      </div>
      <style jsx>{`
        .vm { display: flex; gap: 12px; align-items: stretch; background: var(--panel); border: 3px solid var(--ink); padding: 12px; box-shadow: 4px 4px 0 var(--ink); }
        .vm-btn { flex: none; width: 56px; border: 0; background: var(--ink); cursor: pointer; display: grid; place-items: center; }
        .vm-btn:hover { background: var(--ink-soft); }
        .play { width: 0; height: 0; border-left: 18px solid #141414; border-top: 12px solid transparent; border-bottom: 12px solid transparent; margin-left: 4px; }
        .pause { width: 16px; height: 20px; border-left: 6px solid #141414; border-right: 6px solid #141414; }
        .vm-body { flex: 1; min-width: 0; }
        .vm-top { display: flex; justify-content: space-between; align-items: center; color: var(--ink-soft); margin-bottom: 4px; }
        .vm-time { font-family: var(--font-mono); font-size: 0.66rem; }
        .vm-cap { font-family: var(--font-mono); font-size: 0.62rem; color: var(--ink-soft); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
      `}</style>
    </div>
  );
}
