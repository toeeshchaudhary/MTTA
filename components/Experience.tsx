'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, MiniMap, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { AnimatePresence, motion } from 'framer-motion';
import { contentBounds, RIBBON, type Line } from '@/content/lines';
import type { Station, Pin } from '@/lib/content';
import { KIND_BY_ID, type TerrainFeature } from '@/components/map/terrain-kinds';
import TransitMap from './map/TransitMap';
import DepartureBoard from './map/DepartureBoard';
import Controls from './map/Controls';
import StationDrawer from './StationDrawer';
import IndexPanel from './IndexPanel';
import Intro from './Intro';
import ThemeToggle from './ThemeToggle';

type AboutData = { name: string; role: string; blurb: string; links: { label: string; url: string }[] };
const DEFAULT_ABOUT: AboutData = { name: 'Toeesh Chaudhary', role: '', blurb: '', links: [] };

export default function Experience({ lines, stations, terrain = [], pins = [], origin = [700, 96], originLabel = 'the origin — toeesh', originCue = 'about ↗', about = DEFAULT_ABOUT, initialStop }: { lines: Line[]; stations: Station[]; terrain?: TerrainFeature[]; pins?: Pin[]; origin?: [number, number]; originLabel?: string; originCue?: string; about?: AboutData; initialStop?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [started, setStarted] = useState(true);
  const [indexOpen, setIndexOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [motionOff, setMotionOff] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const tw = useRef<ReactZoomPanPinchRef>(null);
  // trains run by default and are controlled by the motion toggle. (We don't auto-suppress
  // on prefers-reduced-motion — they'd silently never show on motion-averse setups; the
  // "motion: off" toggle is the explicit opt-out.)
  const trains = started && !motionOff;

  useEffect(() => { try { setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches); } catch {} }, []);

  // first-visit onboarding — show once (after the intro), then remember
  const dismissOnboard = useCallback(() => { setShowOnboard(false); try { localStorage.setItem('onboarded', '1'); } catch {} }, []);
  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem('onboarded') === '1'; } catch {}
    if (done) return;
    const t = setTimeout(() => setShowOnboard(true), 2700);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (selectedId) dismissOnboard(); }, [selectedId, dismissOnboard]);

  // idle nudge — if a first-timer just stares, gently bounce "start here"
  useEffect(() => {
    if (selectedId || showOnboard) { setNudge(false); return; }
    let t: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(t); setNudge(false); t = setTimeout(() => setNudge(true), 15000); };
    arm();
    const evs = ['pointerdown', 'keydown', 'wheel'] as const;
    evs.forEach((e) => window.addEventListener(e, arm));
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, arm)); };
  }, [selectedId, showOnboard]);

  const bounds = useMemo(() => contentBounds(lines, [...stations, { x: origin[0], y: origin[1] }], [...terrain, ...pins]), [lines, stations, terrain, pins, origin]);
  const byId = useMemo(() => Object.fromEntries(stations.map((s) => [s.id, s])), [stations]);
  const featured = useMemo(() => ['hello', 'the-rice', 'the-map-editor', 'why-a-map'].filter((id) => byId[id]).slice(0, 3), [byId]);
  const countByLine = useMemo(() => { const m: Record<string, number> = {}; for (const s of stations) m[s.line] = (m[s.line] || 0) + 1; return m; }, [stations]);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  // system codes — line-no · stop-index (e.g. 02·01), stations come pre-sorted by line then position
  const stationCode = useMemo(() => {
    const lineNo = Object.fromEntries(lines.map((l, i) => [l.id, i + 1]));
    const per: Record<string, number> = {}; const code: Record<string, string> = {};
    for (const s of stations) { per[s.line] = (per[s.line] || 0) + 1; const ln = lineNo[s.line] as number | undefined; code[s.id] = ln ? `${pad2(ln)}·${pad2(per[s.line])}` : ''; }
    return code;
  }, [lines, stations]);
  const selected = selectedId ? byId[selectedId] : null;
  const activeLine = focusLine ?? hoveredLine;

  const siblings = useMemo(() => (selected ? stations.filter((s) => s.line === selected.line) : []), [selected, stations]);
  const idx = selected ? siblings.findIndex((s) => s.id === selected.id) : -1;

  const flyTo = useCallback((id: string) => {
    try { tw.current?.zoomToElement(`st-${id}`, 1.35, 650, 'easeOut'); } catch {}
  }, []);

  // "ride the line" — on a fresh visit, sweep the camera across the network then settle
  const rideTheLine = useCallback(() => {
    const t = tw.current; if (!t || stations.length < 2) return;
    const byX = [...stations].sort((a, b) => a.x - b.x);
    const first = byX[0], last = byX[byX.length - 1];
    try {
      t.zoomToElement(`st-${first.id}`, 1.5, 0); // jump tight to the leftmost stop
      setTimeout(() => { try { t.zoomToElement(`st-${last.id}`, 1.0, 2600, 'easeOut'); } catch {} }, 450); // glide across
      setTimeout(() => { try { t.resetTransform(1300, 'easeOut'); } catch {} }, 3300); // settle to the full view
    } catch {}
  }, [stations]);

  // ride-the-line camera glide — once per session, skipped on shared-stop links or reduced motion
  useEffect(() => {
    if (!started || initialStop || reduced || motionOff) return;
    let did = false; try { did = sessionStorage.getItem('glided') === '1'; } catch {}
    if (did) return;
    try { sessionStorage.setItem('glided', '1'); } catch {}
    const t = setTimeout(rideTheLine, 900);
    return () => clearTimeout(t);
  }, [started, initialStop, reduced, motionOff, rideTheLine]);

  const select = useCallback((id: string | null, fly = true) => {
    setSelectedId(id);
    // canonical, shareable URL per stop — /s/<id> is a real SSG route with its own OG card
    try { window.history.replaceState(null, '', id ? `/s/${id}` : '/'); } catch {}
    if (id && fly) setTimeout(() => flyTo(id), 30);
  }, [flyTo]);

  const pickFromIndex = useCallback((id: string) => { setIndexOpen(false); setExpanded(false); select(id); }, [select]);

  const toggleFocus = useCallback((lineId: string) => {
    setFocusLine((cur) => {
      const next = cur === lineId ? null : lineId;
      if (next) {
        const last = [...stations].reverse().find((s) => s.line === next);
        if (last) setTimeout(() => flyTo(last.id), 30);
      }
      return next;
    });
  }, [stations, flyTo]);

  // ride-the-line tour: step the camera through a thread's stops, opening each card
  const tourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [touring, setTouring] = useState<string | null>(null);
  const stopTour = useCallback(() => { if (tourTimer.current) clearTimeout(tourTimer.current); tourTimer.current = null; setTouring(null); }, []);
  const rideLineTour = useCallback((lineId: string) => {
    if (tourTimer.current) clearTimeout(tourTimer.current);
    const stops = stations.filter((s) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(lineId));
    if (!stops.length) { stopTour(); return; }
    setFocusLine(lineId); setTouring(lineId); setExpanded(false);
    let i = 0;
    const step = () => {
      if (i >= stops.length) { setTouring(null); tourTimer.current = setTimeout(() => { try { tw.current?.resetTransform(1200, 'easeOut'); } catch {} }, 300); return; }
      select(stops[i].id); i += 1;
      tourTimer.current = setTimeout(step, 2600);
    };
    step();
  }, [stations, select, stopTour]);
  // hand control back to the visitor if they scroll or hit a key mid-tour
  useEffect(() => {
    if (!touring) return;
    const cancel = () => stopTour();
    window.addEventListener('wheel', cancel); window.addEventListener('keydown', cancel);
    return () => { window.removeEventListener('wheel', cancel); window.removeEventListener('keydown', cancel); };
  }, [touring, stopTour]);

  const toggleMotion = () => {
    setMotionOff((m) => {
      const next = !m;
      document.documentElement.classList.toggle('no-motion', next);
      return next;
    });
  };

  useEffect(() => {
    const s = initialStop || new URL(window.location.href).searchParams.get('s');
    if (s && byId[s]) { setSelectedId(s); setTimeout(() => flyTo(s), 700); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId]);

  // keyboard: "/" or ⌘K opens index, arrows ride stop-to-stop, esc closes things
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && /INPUT|TEXTAREA|SELECT/.test(el.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIndexOpen((v) => !v); return; }
      if (typing) return;
      if (e.key === '/' && !indexOpen) { e.preventDefault(); setIndexOpen(true); return; }
      if (e.key === 'Escape') { setIndexOpen(false); setAboutOpen(false); setFocusLine(null); stopTour(); return; }
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const list = focusLine
          ? stations.filter((s) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(focusLine))
          : selected ? stations.filter((s) => s.line === selected.line) : stations;
        if (!list.length) return;
        e.preventDefault();
        const cur = selected ? list.findIndex((s) => s.id === selected.id) : -1;
        const next = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
        select(list[next].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [indexOpen, focusLine, selected, stations, select, stopTour]);

  return (
    <div className="stage">
      <Intro onDone={() => setStarted(true)} />

      <TransformWrapper
        ref={tw}
        initialScale={0.92}
        minScale={0.34}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        smooth={false}
        wheel={{ step: 0.14 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: false }}
      >
        <TransformComponent wrapperClass="tc-wrap" wrapperStyle={{ width: '100vw', height: '100vh' }} contentStyle={{ width: bounds.w, height: bounds.h }}>
          <TransitMap
            lines={lines}
            stations={stations}
            terrain={terrain}
            pins={pins}
            selectedId={selectedId}
            activeLine={activeLine}
            started={started}
            trains={trains}
            onHoverLine={setHoveredLine}
            onSelect={(id) => { setExpanded(false); select(id); }}
            onOrigin={() => setAboutOpen(true)}
            origin={origin}
            originLabel={originLabel}
            originCue={originCue}
            featured={featured}
            codeOf={stationCode}
          />
        </TransformComponent>
        <Controls onIndex={() => setIndexOpen(true)} />
        <MiniMap width={190} borderColor="var(--ink)" className="mini" previewClassName="mini-vp">
          <svg viewBox={bounds.viewBox} width={bounds.w} height={bounds.h} style={{ display: 'block' }}>
            <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="var(--canvas)" />
            {terrain.map((f) => { const k = KIND_BY_ID[f.kind] ?? KIND_BY_ID.block; return <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} rx={k.round} fill={k.fill} />; })}
            {lines.map((l) => <path key={l.id} d={l.d} fill="none" stroke={l.color} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round" />)}
            {stations.map((s) => <circle key={s.id} cx={s.x} cy={s.y} r={16} fill="#fff" stroke="#141414" strokeWidth={6} />)}
          </svg>
        </MiniMap>
      </TransformWrapper>

      {/* HUD — masthead pinned top-right, like the title block of a published map */}
      {started && <DepartureBoard lines={lines} stations={stations} onPick={(id) => { setExpanded(false); select(id); }} />}

      <header className="masthead">
        <button className="brandmark" onClick={() => setAboutOpen(true)} aria-label="About toeesh">toeesh<span className="bm-net">.network</span></button>
        <div className="mast-desc mono"><span>a wayfinding system</span><span className="mast-dot">·</span><span>slowly living</span></div>
      </header>

      <div className="hud-tl">
        <div className="hud-actions">
          {featured.length > 0 && <button className={`start-here ${nudge ? 'nudge' : ''}`} onClick={() => { setExpanded(false); select(featured[0]); }}>start here ↘</button>}
          <button className="open-index" onClick={() => setAboutOpen(true)}>⊙ about</button>
          <button className="open-index" onClick={() => setIndexOpen(true)}>⊕ index <span className="mono">/</span></button>
        </div>
        <div className="mono tag">drag · zoom · tap a stop</div>
      </div>

      <aside className="legend" aria-label="The network key">
        <div className="legend-head">
          <span className="mono legend-title">the network</span>
          <span className="mono legend-count">{pad2(lines.length)} threads · {pad2(stations.length)} stops</span>
        </div>
        <div className={`leg-status mono ${touring ? 'touring' : ''}`}><span className="leg-live" />{touring ? 'now touring · enjoy the ride' : 'all lines running · slowly living'}</div>
        <ol className="leg-list">
          {lines.map((l, i) => (
            <li key={l.id} className="leg-li">
              <button
                className={`leg ${focusLine === l.id ? 'leg-on' : ''}`}
                style={{ opacity: activeLine && activeLine !== l.id ? 0.32 : 1 }}
                onMouseEnter={() => setHoveredLine(l.id)}
                onMouseLeave={() => setHoveredLine(null)}
                onClick={() => toggleFocus(l.id)}
              >
                <span className="leg-no mono">{pad2(i + 1)}</span>
                <span className={`shape ${l.shape}`} style={l.shape === 'triangle' ? { color: l.color } : { background: l.color }} />
                <b className="leg-label">{l.label}</b>
                <span className="leg-blurb">{l.blurb}</span>
                <span className="leg-n mono">{countByLine[l.id] || 0}</span>
              </button>
              <button className={`leg-ride ${touring === l.id ? 'on' : ''}`} title={touring === l.id ? 'stop the tour' : `ride the ${l.label} line`} aria-label={touring === l.id ? 'stop tour' : `ride the ${l.label} line`} onClick={() => (touring === l.id ? stopTour() : rideLineTour(l.id))}>{touring === l.id ? '■' : '▶'}</button>
            </li>
          ))}
        </ol>
        <div className="legend-ctl">
          <ThemeToggle />
          <button className="tt" onClick={toggleMotion}>motion: {motionOff ? 'off' : 'on'}</button>
        </div>
        <div className="legend-links">
          <a className="tt" href="https://github.com/NerdsForGaming" target="_blank" rel="noreferrer">github ↗</a>
          <a className="tt" href="https://www.cosmos.so/toeeshchaudhary" target="_blank" rel="noreferrer">cosmos ↗</a>
          <a className="tt" href="mailto:thesonofdevilhunter1@gmail.com">email ↗</a>
        </div>
        <div className="mono colophon">wayfinding system · delhi · v1</div>
      </aside>

      <AnimatePresence>
      {aboutOpen && (
        <motion.div className="about-scrim" onClick={() => setAboutOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
          <motion.div
            className="about-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <button className="about-x" onClick={() => setAboutOpen(false)} aria-label="close">✕</button>
            <div className="about-band" />
            <div className="mono about-kicker">slowly living</div>
            <h1 className="about-name">{about.name}</h1>
            <div className="about-role">{about.role}</div>
            <div className="mono about-tags">artist · gamedev · ricer · curator</div>
            <p className="about-blurb">{about.blurb}</p>
            <div className="about-links">
              {about.links.map((l, i) => (
                l.url.startsWith('mailto:') || l.url.startsWith('/')
                  ? <a key={i} href={l.url}>{l.label}</a>
                  : <a key={i} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
              ))}
              {featured[0] && <button onClick={() => { setAboutOpen(false); setExpanded(false); select(featured[0]); }}>start here ↘</button>}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {started && showOnboard && (
        <div className="onboard">
          <button className="ob-x" onClick={dismissOnboard} aria-label="dismiss">✕</button>
          <span className="ob-k mono">new here?</span>
          <p className="ob-p">This is <b>toeesh</b> drawn as a transit map. <b>Tap any stop</b> to read it, follow a <b>thread</b> from the legend, or jump to a highlighted <b>start here</b> stop.</p>
          <div className="ob-act">
            {featured[0] && <button className="ob-go" onClick={() => { dismissOnboard(); setExpanded(false); select(featured[0]); }}>start here ↘</button>}
            <button className="ob-dismiss" onClick={dismissOnboard}>explore freely</button>
          </div>
        </div>
      )}

      <IndexPanel open={indexOpen} lines={lines} stations={stations} onClose={() => setIndexOpen(false)} onSelect={pickFromIndex} />

      <StationDrawer
        station={selected}
        code={selected ? stationCode[selected.id] : ''}
        line={selected ? lines.find((l) => l.id === selected.line) ?? null : null}
        expanded={expanded}
        hasPrev={idx > 0}
        hasNext={idx >= 0 && idx < siblings.length - 1}
        onPrev={() => idx > 0 && select(siblings[idx - 1].id)}
        onNext={() => idx >= 0 && idx < siblings.length - 1 && select(siblings[idx + 1].id)}
        onExpand={() => setExpanded(true)}
        onCollapse={() => setExpanded(false)}
        onClose={() => { setExpanded(false); select(null); }}
      />

      <style jsx>{`
        .stage { position: fixed; inset: 0; background: var(--bg); }
        /* masthead — title block of the system, pinned top-right */
        .masthead { position: absolute; top: 16px; right: 24px; z-index: 16; display: flex; flex-direction: column; align-items: flex-end; }
        .brandmark {
          font-family: var(--font-sans); font-weight: 800; letter-spacing: -0.05em; line-height: 0.86;
          font-size: clamp(2rem, 4.4vw, 3.4rem); color: var(--ink);
          background: none; border: 0; cursor: pointer; padding: 0;
        }
        .bm-net { color: var(--ink-soft); }
        .brandmark:hover .bm-net { color: var(--ink); }
        .mast-desc { display: flex; gap: 8px; align-items: center; margin-top: 8px; padding-top: 7px; border-top: 1.5px solid var(--ink); color: var(--ink-soft); font-size: 0.58rem; letter-spacing: 0.16em; }
        .mast-dot { opacity: 0.5; }
        .hud-tl { position: absolute; top: 20px; left: 22px; z-index: 15; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
        .tag { color: var(--ink-soft); letter-spacing: 0.16em; }
        :global(.mini) { position: absolute !important; right: 70px; bottom: 22px; z-index: 14; overflow: hidden; background: var(--canvas); border: 3px solid var(--ink) !important; box-shadow: 5px 5px 0 var(--ink); }
        /* keep the viewport indicator's "spotlight" contained to the minimap — the library's
           default box-shadow spreads 10,000,000px and would veil the whole page (grey overlay). */
        :global(.mini-vp) { border: 2px solid var(--ink) !important; background: rgba(20,20,20,0.08) !important; box-shadow: rgba(20,20,20,0.18) 0 0 0 10000000px !important; }
        .hud-actions { display: flex; gap: 8px; }
        .open-index {
          font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
          background: var(--ink); color: var(--bg); border: 3px solid var(--ink); padding: 8px 12px; cursor: pointer;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
        }
        .open-index:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .open-index .mono { opacity: 0.6; margin-left: 4px; }
        .start-here {
          font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
          background: var(--ink); color: var(--bg); border: 3px solid #111; padding: 8px 12px; cursor: pointer;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
        }
        .start-here:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 rgba(0,0,0,0.3); }
        .start-here.nudge { animation: nudge 1s ease-in-out infinite; }
        @keyframes nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        :global(:root.no-motion) .start-here.nudge { animation: none; }
        /* onboarding card */
        .onboard {
          position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 25;
          width: min(520px, 92vw); background: var(--panel); color: var(--ink);
          border: 3px solid var(--ink); box-shadow: 8px 8px 0 var(--ink); padding: 16px 18px 14px;
        }
        .ob-x { position: absolute; top: 8px; right: 8px; background: none; border: 2px solid var(--line); color: var(--ink); width: 26px; height: 26px; cursor: pointer; }
        .ob-x:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .ob-k { color: var(--ink); font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
        .ob-p { margin: 6px 0 12px; line-height: 1.5; font-size: 0.98rem; }
        .ob-act { display: flex; gap: 8px; }
        .ob-go { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; background: var(--ink); color: var(--bg); border: 2px solid #111; padding: 8px 12px; cursor: pointer; }
        .ob-dismiss { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; background: none; border: 2px solid var(--ink); color: var(--ink); padding: 8px 12px; cursor: pointer; }
        .ob-go:hover, .ob-dismiss:hover { background: var(--ink); color: var(--bg); }
        @media (max-width: 700px) { .onboard { bottom: 12px; } }
        .legend-links { display: flex; gap: 6px; margin: 8px 14px 0; }
        :global(.legend-links .tt) { text-decoration: none; }
        /* About card styles live in globals.css — motion components don't pick up styled-jsx scoping */
        .legend {
          position: absolute; left: 22px; bottom: 20px; z-index: 15;
          background: var(--panel); border: 2px solid var(--ink); padding: 0;
          display: flex; flex-direction: column; box-shadow: 6px 6px 0 var(--ink);
          width: 296px;
        }
        .legend-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 11px 14px 10px; border-bottom: 1.5px solid var(--ink); }
        .legend-title { color: var(--ink); font-size: 0.62rem; letter-spacing: 0.18em; }
        .legend-count { color: var(--ink-soft); font-size: 0.54rem; letter-spacing: 0.1em; }
        /* LED status readout — inset dark strip, matches the departures board "LIVE" pill */
        .leg-status { display: flex; align-items: center; gap: 7px; margin: 9px 12px; padding: 6px 10px;
          background: #0e0e10; border: 1.5px solid var(--ink); color: #6fe08a;
          font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; }
        .leg-status.touring { color: #ffcf00; }
        .leg-live { width: 7px; height: 7px; border-radius: 50%; background: #6fe08a; flex: none; animation: leg-pulse 2.2s ease-out infinite; }
        .leg-status.touring .leg-live { background: #ffcf00; }
        @keyframes leg-pulse { 0% { box-shadow: 0 0 0 0 rgba(111,224,138,0.5); } 70% { box-shadow: 0 0 0 6px rgba(111,224,138,0); } 100% { box-shadow: 0 0 0 0 rgba(111,224,138,0); } }
        @media (prefers-reduced-motion: reduce) { .leg-live { animation: none; } }
        .leg-list { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow: auto; }
        .leg-list li + li { border-top: 1px solid var(--line); }
        .leg-li { display: flex; align-items: stretch; }
        .leg-li .leg { flex: 1; min-width: 0; }
        .leg-ride { flex: none; width: 30px; background: none; border: 0; border-left: 1px solid var(--line); color: var(--ink-soft); cursor: pointer; font-size: 0.7rem; }
        .leg-ride:hover { background: var(--ink); color: var(--bg); }
        .leg-ride.on { background: var(--yellow); color: #111; }
        .leg { display: grid; grid-template-columns: auto 15px auto 1fr auto; align-items: center; column-gap: 10px; width: 100%; background: none; border: 0; cursor: pointer; color: var(--ink); padding: 9px 14px; text-align: left; }
        .leg:hover, .leg-on { background: var(--ink); color: var(--bg); }
        .leg-no { font-size: 0.58rem; letter-spacing: 0.05em; color: var(--ink-soft); }
        .leg:hover .leg-no, .leg-on .leg-no { color: var(--bg); opacity: 0.7; }
        .leg-label { font-size: 1.02rem; letter-spacing: -0.01em; }
        .leg-blurb { font-family: var(--font-mono); font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .leg-n { font-size: 0.62rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
        .leg:hover .leg-blurb, .leg-on .leg-blurb, .leg:hover .leg-n, .leg-on .leg-n { color: var(--bg); }
        .leg .shape { width: 15px; height: 15px; }
        .legend-ctl { display: flex; gap: 6px; margin: 0 14px; border-top: 1.5px solid var(--ink); padding: 10px 0 0; }
        .colophon { color: var(--ink-soft); font-size: 0.5rem; letter-spacing: 0.14em; opacity: 0.7; padding: 10px 14px 12px; }
        :global(.tt) { font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; background: none; border: 2px solid var(--ink); color: var(--ink); padding: 5px 8px; cursor: pointer; }
        :global(.tt:hover) { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        @media (max-width: 700px) {
          :global(.mini) { display: none !important; }
          .masthead { top: 12px; right: 12px; }
          .brandmark { font-size: 1.3rem; }
          .bm-net, .mast-desc { display: none; }
          .hud-tl { top: 12px; left: 12px; gap: 8px; }
          .tag { display: none; }
          .hud-actions { gap: 5px; }
          .open-index, .start-here { font-size: 0.55rem; padding: 6px 8px; border-width: 2px; box-shadow: 3px 3px 0 rgba(0,0,0,0.3); }
          .open-index .mono { display: none; }
          .legend { left: 12px; right: 12px; bottom: 12px; width: auto; max-width: none; }
          .leg-blurb { display: none; }
          .leg-list { max-height: 34vh; }
          .leg { padding: 12px 14px; } /* bigger tap targets */
          .leg-ride { width: 44px; font-size: 0.85rem; }
          .leg-status, .colophon { display: none; }
          .legend-links { flex-wrap: wrap; }
          .onboard { top: 64px; bottom: auto; left: 12px; right: 12px; width: auto; transform: none; }
        }
      `}</style>
    </div>
  );
}
