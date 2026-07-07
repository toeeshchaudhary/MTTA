'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { TransformWrapper, TransformComponent, MiniMap, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { AnimatePresence, motion } from 'framer-motion';
import { contentBounds, RIBBON, ghost, type Line } from '@/content/lines';
import type { Station, Pin } from '@/lib/content';
import { kindOf, type TerrainFeature } from '@/components/map/terrain-kinds';
import TransitMap from './map/TransitMap';
import DepartureBoard from './map/DepartureBoard';
import Controls from './map/Controls';
import Intro from './Intro';
import ThemeToggle from './ThemeToggle';
import { planTrip } from '@/lib/route';
import { PLAY_DEFAULTS, type Play } from '@/lib/play';
import { setSfxEnabled, chimeOpen, chimeClose } from '@/lib/sfx';
// Panels that only mount on user intent (open a stop, cmd-K the index, plan a trip)
// — deferred so their JS (and their transitive react-markdown / wavesurfer weight)
// doesn't ship with the initial bundle and delay TTI.
import type { TripResult } from './TripPlanner';
const StationDrawer = dynamic(() => import('./StationDrawer'), { ssr: false });
const IndexPanel = dynamic(() => import('./IndexPanel'), { ssr: false });
const TripPlanner = dynamic(() => import('./TripPlanner'), { ssr: false });

type AboutData = { name: string; role: string; blurb: string; links: { label: string; url: string }[] };
const DEFAULT_ABOUT: AboutData = { name: 'Toeesh Chaudhary', role: '', blurb: '', links: [] };
const LABEL_ZOOM = 1.1; // initialScale is 0.92, so the at-rest overview stays clean; names fade in once you zoom in

export default function Experience({ lines, stations, terrain = [], pins = [], origin = [700, 96], originLabel = 'the origin — toeesh', originCue = 'about ↗', about = DEFAULT_ABOUT, play = PLAY_DEFAULTS, featured: featuredIds = [], initialStop }: { lines: Line[]; stations: Station[]; terrain?: TerrainFeature[]; pins?: Pin[]; origin?: [number, number]; originLabel?: string; originCue?: string; about?: AboutData; play?: Play; featured?: string[]; initialStop?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredLines, setHoveredLines] = useState<string[]>([]);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [started, setStarted] = useState(false); // flips true when the Intro splash clears, so the map choreography is actually seen
  const [trainsReady, setTrainsReady] = useState(false); // trains hold until the lines have drawn on
  const [indexOpen, setIndexOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [motionOff, setMotionOff] = useState(false);
  const [coarse, setCoarse] = useState(false); // touch device — skip the disorienting auto camera glide
  const [expanded, setExpanded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false); // station names reveal once zoomed in past LABEL_ZOOM
  const [legendOpen, setLegendOpen] = useState(true); // on touch the legend starts collapsed (a tap-to-expand bottom bar)
  const tw = useRef<ReactZoomPanPinchRef>(null);
  // trains run by default and are controlled by the motion toggle. (We don't auto-suppress
  // on prefers-reduced-motion — they'd silently never show on motion-averse setups; the
  // "motion: off" toggle is the explicit opt-out.)
  const trains = started && trainsReady && !motionOff;
  const crittersRun = started && trainsReady && !motionOff && play.critters;
  const [nightOwl, setNightOwl] = useState(false);
  const [owlMsg, setOwlMsg] = useState<string | null>(null);   // toast when night-owl flips
  const owlMounted = useRef(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [tripResult, setTripResult] = useState<TripResult>(null);

  useEffect(() => { try { setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches); setCoarse(matchMedia('(pointer: coarse)').matches); } catch {} }, []);

  // legend starts collapsed on touch (it would otherwise eat most of a phone screen); a stored
  // pref wins, else default open on desktop / closed on coarse pointers.
  useEffect(() => {
    try {
      const v = localStorage.getItem('legend-open');
      if (v != null) setLegendOpen(v === '1');
      else if (matchMedia('(pointer: coarse)').matches) setLegendOpen(false);
    } catch {}
  }, []);
  const toggleLegend = useCallback(() => setLegendOpen((o) => { const n = !o; try { localStorage.setItem('legend-open', n ? '1' : '0'); } catch {} return n; }), []);

  // hold the trains until the intro cascade (origin → notes → terrain → lines → stops) has
  // played, then let them fade in — otherwise they're already mid-run the instant the map appears
  useEffect(() => {
    if (!started) { setTrainsReady(false); return; }
    const t = setTimeout(() => setTrainsReady(true), 3400);
    return () => clearTimeout(t);
  }, [started]);

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
  // spotlight stops: site-authored order wins; otherwise self-heal to real content so the
  // "start here" CTA + pulse are never dead (welcome first, skipping auto-generated termini).
  const featured = useMemo(() => {
    const fromSite = (featuredIds ?? []).filter((id) => byId[id]).slice(0, 3);
    if (fromSite.length) return fromSite;
    const auto: string[] = [];
    if (byId['welcome-mtta']) auto.push('welcome-mtta');
    for (const s of stations) {
      if (auto.length >= 3) break;
      if (s.id !== 'welcome-mtta' && !/(^terminus-|-terminus$)/.test(s.id)) auto.push(s.id);
    }
    return auto.slice(0, 3);
  }, [featuredIds, byId, stations]);
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
  // hovering an interchange lights every thread it sits on; memoised so the identity is
  // stable between renders (TransitMap is React.memo'd on it)
  const activeLines = useMemo(() => (focusLine ? [focusLine] : hoveredLines), [focusLine, hoveredLines]);

  const siblings = useMemo(() => (selected ? stations.filter((s) => s.line === selected.line) : []), [selected, stations]);
  const idx = selected ? siblings.findIndex((s) => s.id === selected.id) : -1;

  const flyTo = useCallback((id: string) => {
    try { tw.current?.zoomToElement(`st-${id}`, 1.35, 650, 'easeOut'); } catch {}
  }, []);

  // frame the "home" part — the origin + central spine + welcome — so opening the map
  // lands you on the meaningful centre, not a tiny full-network overview. Fits the invisible
  // #home-anchor rect (drawn over that region in TransitMap) to the viewport; the library
  // handles the maths from the real DOM. Pan/zoom out to explore the rest.
  const focusHome = useCallback((ms = 0) => {
    const t = tw.current; if (!t) return;
    // centre the home region (origin + central + welcome) at a gentle zoom
    try { t.zoomToElement('home-anchor', 0.9, ms, 'easeOut'); } catch {}
  }, []);

  // "ride the line" — on a fresh visit, sweep the camera across the network then settle home
  const rideTheLine = useCallback(() => {
    const t = tw.current; if (!t || stations.length < 2) return;
    const byX = [...stations].sort((a, b) => a.x - b.x);
    const first = byX[0], last = byX[byX.length - 1];
    try {
      t.zoomToElement(`st-${first.id}`, 1.5, 0); // jump tight to the leftmost stop
      setTimeout(() => { try { t.zoomToElement(`st-${last.id}`, 1.0, 2600, 'easeOut'); } catch {} }, 450); // glide across
      setTimeout(() => focusHome(1300), 3300); // settle onto the home part
    } catch {}
  }, [stations, focusHome]);

  // ride-the-line camera glide — once per session, skipped on shared-stop links or reduced motion
  useEffect(() => {
    if (!started || initialStop || reduced || motionOff || coarse) return; // coarse: the camera glide stutters on phones
    let did = false; try { did = sessionStorage.getItem('glided') === '1'; } catch {}
    if (did) return;
    try { sessionStorage.setItem('glided', '1'); } catch {}
    const t = setTimeout(rideTheLine, 900);
    return () => clearTimeout(t);
  }, [started, initialStop, reduced, motionOff, coarse, rideTheLine]);

  // open focused on the home part (unless it's a shared-stop deep link). A short delay
  // lets the SVG (incl. #home-anchor) mount so zoomToElement can measure it. The glide,
  // when it runs, later re-settles home too.
  useEffect(() => {
    if (initialStop) return;
    const t = setTimeout(() => focusHome(0), 140);
    return () => clearTimeout(t);
  }, [initialStop, focusHome]);

  // tracks whether we've pushed a stop entry onto history (so Back closes the drawer)
  const pushedRef = useRef(false);
  const select = useCallback((id: string | null, fly = true) => {
    setSelectedId(id);
    // closing: drop focus from the station marker so no focus ring lingers on the map
    if (!id) { try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch {} }
    if (id) chimeOpen(); else if (pushedRef.current) chimeClose();   // subway door chime (no-op unless sounds on)
    // canonical, shareable URL per stop — /s/<id> is a real SSG route with its own OG card.
    // First open pushes a history entry (Back closes it); switching stops replaces in place.
    try {
      if (id) {
        const url = `/s/${id}`;
        if (pushedRef.current) window.history.replaceState({ stop: id }, '', url);
        else { window.history.pushState({ stop: id }, '', url); pushedRef.current = true; }
      } else if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back(); // pops the stop entry; popstate handler syncs state
        return;
      } else {
        window.history.replaceState({}, '', '/');
      }
    } catch {}
    if (id && fly) setTimeout(() => flyTo(id), 30);
  }, [flyTo]);

  // sound kit follows the admin's play.sounds flag
  useEffect(() => { setSfxEnabled(play.sounds); }, [play.sounds]);

  // night-owl easter egg — the Konami code flips a neon mode (if enabled in admin)
  useEffect(() => { document.documentElement.classList.toggle('night-owl', nightOwl); }, [nightOwl]);
  // celebrate the reveal with a toast (skip the initial mount so it doesn't fire on load)
  useEffect(() => {
    if (!owlMounted.current) { owlMounted.current = true; return; }
    setOwlMsg(nightOwl ? '🦉 night owl — the network after dark' : '☀︎ back to daylight');
    const t = setTimeout(() => setOwlMsg(null), 2600);
    return () => clearTimeout(t);
  }, [nightOwl]);
  useEffect(() => {
    if (!play.nightOwl) return;
    const seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      i = k === seq[i] ? i + 1 : (k === seq[0] ? 1 : 0);
      if (i === seq.length) { i = 0; setNightOwl((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play.nightOwl]);

  // browser Back/Forward ↔ open stop
  useEffect(() => {
    const onPop = () => {
      const m = /^\/s\/([^/]+)/.exec(window.location.pathname);
      const id = m && byId[m[1]] ? m[1] : null;
      pushedRef.current = !!id;
      setSelectedId(id);
      setExpanded(false);
      if (id) setTimeout(() => flyTo(id), 30);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [byId, flyTo]);

  const pickFromIndex = useCallback((id: string) => { setIndexOpen(false); setExpanded(false); select(id); }, [select]);

  // stable handlers for the memoised map + departures board — inline arrows here would
  // defeat React.memo and re-render the whole SVG on every unrelated state flip
  const openStop = useCallback((id: string) => { setExpanded(false); select(id); }, [select]);
  const openAbout = useCallback(() => setAboutOpen(true), []);
  const quips = useMemo(() => (play.serviceQuips ? play.quips : []), [play.serviceQuips, play.quips]);

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

  // ride an explicit list of stops (used by the trip planner) — camera steps through each
  const rideStops = useCallback((ids: string[]) => {
    if (tourTimer.current) clearTimeout(tourTimer.current);
    if (!ids.length) { stopTour(); return; }
    setTouring('trip'); setExpanded(false);
    let i = 0;
    const step = () => {
      if (i >= ids.length) { setTouring(null); tourTimer.current = setTimeout(() => { try { tw.current?.resetTransform(1200, 'easeOut'); } catch {} }, 500); return; }
      select(ids[i]); i += 1;
      tourTimer.current = setTimeout(step, 1600);
    };
    step();
  }, [select, stopTour]);

  // "surprise me" — hop to a random stop (skip the current one)
  const surprise = useCallback(() => {
    stopTour(); setExpanded(false); setTripOpen(false);
    const pool = stations.filter((s) => s.id !== selectedId);
    if (!pool.length) return;
    select(pool[Math.floor(Math.random() * pool.length)].id);
  }, [stations, selectedId, select, stopTour]);

  // plan + ride a trip between two stops
  const doPlan = useCallback((fromId: string, toId: string) => {
    const r = planTrip(lines, stations, fromId, toId);
    if (!r) { setTripResult({ stops: [], changes: 0, minutes: 0, error: true }); return; }
    setTripResult({ stops: r.stops, changes: r.changes, minutes: r.minutes });
    rideStops(r.stops.map((s) => s.id));
  }, [lines, stations, rideStops]);

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
        // only ride stops when already viewing one / focused on a line — leaves arrows
        // free on the bare map (so the Konami code doesn't open stops as you type it)
        if (!selected && !focusLine) return;
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
        smooth
        wheel={{ step: 0.06 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: false }}
        onTransform={(_r, state) => { const open = state.scale >= LABEL_ZOOM; setLabelsOpen((o) => (o === open ? o : open)); }}
      >
        <TransformComponent wrapperClass="tc-wrap" wrapperStyle={{ width: '100dvw', height: '100dvh' }} contentStyle={{ width: bounds.w, height: bounds.h }}>
          <TransitMap
            lines={lines}
            stations={stations}
            terrain={terrain}
            pins={pins}
            selectedId={selectedId}
            activeLines={activeLines}
            focusedLine={focusLine}
            zoomedIn={labelsOpen}
            started={started}
            trains={trains}
            stationPulse={play.stationPulse}
            expressTrain={play.expressTrain}
            crittersRun={crittersRun}
            onHoverLine={setHoveredLines}
            onSelect={openStop}
            onOrigin={openAbout}
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
            {terrain.map((f) => { const k = kindOf(f); return <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} rx={k.round} fill={k.fill} />; })}
            {lines.map((l) => <path key={l.id} d={l.d} fill="none" stroke={l.color} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round" />)}
            {stations.map((s) => <circle key={s.id} cx={s.x} cy={s.y} r={16} fill="#fff" stroke="#141414" strokeWidth={6} />)}
          </svg>
        </MiniMap>
      </TransformWrapper>

      {/* HUD — masthead pinned top-right, like the title block of a published map */}
      {started && <DepartureBoard lines={lines} stations={stations} focusLine={focusLine} quips={quips} onPick={openStop} />}

      <header className="masthead">
        <button className="brandmark" onClick={() => setAboutOpen(true)} aria-label="About toeesh">
          <span className="bm-mark" aria-hidden="true"><i /></span>
          <span className="bm-word">toeesh<span className="bm-net">.network</span></span>
        </button>
        <div className="mast-desc mono"><span>MTTA</span><span className="mast-dot">·</span><span>a wayfinding system</span><span className="mast-dot">·</span><span>slowly living</span></div>
        <div className="mast-key" aria-hidden="true" title="the network">{lines.map((l) => <span key={l.id} className="mast-key-dot" style={{ background: l.color }} />)}</div>
      </header>

      <div className="hud-tl">
        <div className="hud-actions">
          {featured.length > 0 && <button className={`start-here ${nudge ? 'nudge' : ''}`} onClick={() => { setExpanded(false); select(featured[0]); }}>start here ↘</button>}
          <button className="open-index" onClick={() => setShowOnboard(true)}>? what is this</button>
          <button className="open-index hud-about" onClick={() => setAboutOpen(true)}>⊙ about</button>
          <button className="open-index" onClick={() => setIndexOpen(true)}>⊕ index <span className="mono">/</span></button>
        </div>
        <div className="mono tag">drag · zoom · tap a stop</div>
      </div>

      <aside className={`legend ${legendOpen ? '' : 'min'}`} aria-label="The network key">
        <button className="legend-head" onClick={toggleLegend} aria-expanded={legendOpen} aria-label={legendOpen ? 'Collapse the network key' : 'Expand the network key'}>
          <span className="mono legend-title">the network</span>
          <span className="mono legend-count">{pad2(lines.length)} threads · {pad2(stations.length)} stops</span>
          <span className="legend-chev mono" aria-hidden>{legendOpen ? '▾' : '▸'}</span>
        </button>
        <div className={`leg-status mono ${touring ? 'touring' : ''}`}><span className="leg-live" />{touring ? 'now touring · enjoy the ride' : 'all lines running · slowly living'}</div>
        <ol className="leg-list">
          {lines.map((l, i) => {
            const legColor = l.abandoned ? ghost(l.color) : l.color;
            return (
            <li key={l.id} className="leg-li">
              <button
                className={`leg ${focusLine === l.id ? 'leg-on' : ''} ${l.abandoned ? 'leg-dead' : ''}`}
                style={{ opacity: activeLines.length > 0 && !activeLines.includes(l.id) ? 0.32 : 1 }}
                onMouseEnter={() => setHoveredLines([l.id])}
                onMouseLeave={() => setHoveredLines([])}
                onClick={() => toggleFocus(l.id)}
              >
                <span className="leg-no mono">{pad2(i + 1)}</span>
                <span className={`shape ${l.shape}`} style={l.shape === 'triangle' ? { color: legColor } : { background: legColor }} />
                <b className="leg-label">{l.label}</b>
                {l.abandoned ? <span className="leg-closed mono">closed</span> : <span className="leg-blurb">{l.blurb}</span>}
                <span className="leg-n mono">{countByLine[l.id] || 0}</span>
              </button>
              <button className={`leg-ride ${touring === l.id ? 'on' : ''}`} title={touring === l.id ? 'stop the tour' : `ride the ${l.label} line`} aria-label={touring === l.id ? 'stop tour' : `ride the ${l.label} line`} onClick={() => (touring === l.id ? stopTour() : rideLineTour(l.id))}>{touring === l.id ? '■' : '▶'}</button>
            </li>
            );
          })}
        </ol>
        <div className="leg-feats" aria-label="Station features">
          <div className="mono leg-feats-h">station features</div>
          <ul className="leg-feats-list mono">
            <li><span className="lf-g lf-dot" /> station</li>
            <li><span className="lf-g lf-xfer" /> transfer</li>
            <li><i className="feat-ic">M</i> media inside</li>
            <li><i className="feat-ic">↗</i> links out</li>
            <li><i className="feat-ic feat-star">★</i> start here</li>
            <li><span className="lf-closed">⊘</span> closed</li>
          </ul>
        </div>
        <div className="legend-ctl">
          <ThemeToggle />
          <button className="tt" onClick={toggleMotion}>motion: {motionOff ? 'off' : 'on'}</button>
        </div>
        <div className="legend-ctl">
          <button className="tt" onClick={surprise}>🎲 surprise me</button>
          <button className={`tt ${tripOpen ? 'on' : ''}`} onClick={() => setTripOpen((v) => !v)}>🚉 plan a trip</button>
        </div>
        <div className="legend-links">
          <a className="tt" href="https://github.com/toeeshchaudhary" target="_blank" rel="noreferrer">github ↗</a>
          <a className="tt" href="https://www.cosmos.so/toeeshchaudhary" target="_blank" rel="noreferrer">cosmos ↗</a>
          <a className="tt" href="mailto:toeesh239@gmail.com">email ↗</a>
        </div>
        <div className="mono colophon">wayfinding system · delhi · v1
          <button className={`owl-egg ${nightOwl ? 'lit' : ''}`} onClick={() => setNightOwl((v) => !v)} aria-pressed={nightOwl}
            title="night owl · the network after dark — ↑ ↑ ↓ ↓ ← → ← → b a">🦉</button>
        </div>
      </aside>

      {/* night-owl toast — rewards finding the egg (and confirms the owl-button tap) */}
      <AnimatePresence>
        {owlMsg && (
          <motion.div className="owl-toast mono" role="status"
            initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}>{owlMsg}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      {aboutOpen && (
        <motion.div className="about-scrim" onClick={() => setAboutOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
          <motion.div
            className="about-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-name"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          >
            <button className="about-x" onClick={() => setAboutOpen(false)} aria-label="close">✕</button>
            <div className="about-band" />
            <div className="mono about-kicker">slowly living</div>
            <h1 className="about-name" id="about-name">{about.name}</h1>
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
          <p className="ob-p">This is <b>toeesh</b> drawn as a transit map — each <b>line</b> is a thread of his life, each <b>stop</b> a thing he made or thinks about. <b>Tap any stop</b> to read it, follow a <b>thread</b> from the legend, or jump to a highlighted <b>start here</b> stop.</p>
          <div className="ob-act">
            {featured[0] && <button className="ob-go" onClick={() => { dismissOnboard(); setExpanded(false); select(featured[0]); }}>start here ↘</button>}
            <button className="ob-dismiss" onClick={dismissOnboard}>explore freely</button>
          </div>
        </div>
      )}

      <IndexPanel open={indexOpen} lines={lines} stations={stations} onClose={() => setIndexOpen(false)} onSelect={pickFromIndex} />

      {tripOpen && <TripPlanner lines={lines} stations={stations} result={tripResult} onPlan={doPlan} onClose={() => { setTripOpen(false); setTripResult(null); }} />}

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
          display: flex; align-items: center; gap: 0.34em;
          font-family: var(--font-sans); font-weight: 800; letter-spacing: -0.05em; line-height: 0.86;
          font-size: clamp(2rem, 4.4vw, 3.4rem); color: var(--ink);
          background: none; border: 0; cursor: pointer; padding: 0;
        }
        /* origin-aperture roundel — the brand mark, matches the favicon; scales with the wordmark */
        .bm-mark { width: 0.8em; height: 0.8em; border-radius: 50%; background: var(--ink); display: grid; place-items: center; flex: none; transition: box-shadow 0.25s, transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }
        .bm-mark i { width: 0.3em; height: 0.3em; border-radius: 50%; background: var(--canvas); transition: transform 0.35s; }
        .brandmark:hover .bm-mark { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ink) 16%, transparent); }
        .brandmark:hover .bm-mark i { transform: scale(1.5); }
        .bm-net { color: var(--ink-soft); }
        .brandmark:hover .bm-net { color: var(--ink); }
        .mast-desc { display: flex; gap: 8px; align-items: center; margin-top: 9px; padding-top: 7px; border-top: 1.5px solid var(--ink); color: var(--ink-soft); font-size: 0.58rem; letter-spacing: 0.16em; }
        .mast-dot { opacity: 0.5; }
        /* the network key — one bullet per live line, a signature under the title block */
        .mast-key { display: flex; gap: 5px; margin-top: 8px; }
        .mast-key-dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1.5px var(--canvas); }
        :global(:root.night-owl) .bm-mark { box-shadow: 0 0 12px rgba(180,205,255,0.5); }
        :global(:root.night-owl) .mast-key-dot { box-shadow: 0 0 0 1.5px var(--canvas), 0 0 7px rgba(150,190,255,0.6); }
        .hud-tl { position: absolute; top: max(20px, env(safe-area-inset-top)); left: max(22px, env(safe-area-inset-left)); z-index: 15; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
        .tag { color: var(--ink-soft); letter-spacing: 0.16em; }
        :global(.mini) { position: absolute !important; right: 70px; bottom: 22px; z-index: 14; overflow: hidden; background: var(--canvas); border: 3px solid var(--edge) !important; box-shadow: 5px 5px 0 var(--shadow); }
        /* keep the viewport indicator's "spotlight" contained to the minimap — the library's
           default box-shadow spreads 10,000,000px and would veil the whole page (grey overlay). */
        :global(.mini-vp) { border: 2px solid var(--ink) !important; background: rgba(20,20,20,0.08) !important; box-shadow: rgba(20,20,20,0.18) 0 0 0 10000000px !important; }
        .hud-actions { display: flex; gap: 8px; }
        .open-index {
          font-family: var(--font-sans); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
          background: var(--ink); color: var(--bg); border: 3px solid var(--ink); padding: 8px 12px; cursor: pointer;
          box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
        }
        .open-index:hover { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .open-index .mono { opacity: 0.6; margin-left: 4px; }
        .start-here {
          font-family: var(--font-sans); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
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
        @media (pointer: coarse) { .ob-x { width: 44px; height: 44px; } }
        .ob-k { color: var(--ink); font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
        .ob-p { margin: 6px 0 12px; line-height: 1.5; font-size: 0.98rem; }
        .ob-act { display: flex; gap: 8px; }
        .ob-go { font-family: var(--font-sans); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; background: var(--ink); color: var(--bg); border: 2px solid #111; padding: 8px 12px; cursor: pointer; }
        .ob-dismiss { font-family: var(--font-sans); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; background: none; border: 2px solid var(--ink); color: var(--ink); padding: 8px 12px; cursor: pointer; }
        .ob-go:hover, .ob-dismiss:hover { background: var(--ink); color: var(--bg); }
        @media (max-width: 700px) { .onboard { bottom: 12px; } }
        .legend-links { display: flex; gap: 6px; margin: 8px 14px 0; }
        :global(.legend-links .tt) { text-decoration: none; }
        /* About card styles live in globals.css — motion components don't pick up styled-jsx scoping */
        .legend {
          position: absolute; left: max(22px, env(safe-area-inset-left)); bottom: max(20px, env(safe-area-inset-bottom)); z-index: 15;
          background: var(--panel); border: 2px solid var(--edge); padding: 0;
          display: flex; flex-direction: column; box-shadow: 6px 6px 0 var(--shadow);
          width: min(296px, 84vw);
        }
        .legend-head { width: 100%; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 11px 14px 10px; border: 0; border-bottom: 1.5px solid var(--ink); background: none; color: inherit; font: inherit; text-align: left; cursor: default; }
        .legend-chev { display: none; color: var(--ink-soft); font-size: 0.7rem; align-self: center; }
        .legend-title { color: var(--ink); font-size: 0.62rem; letter-spacing: 0.18em; }
        .legend-count { color: var(--ink-soft); font-size: 0.54rem; letter-spacing: 0.1em; }
        /* LED status readout — inset dark strip, matches the departures board "LIVE" pill */
        .leg-status { display: flex; align-items: center; gap: 7px; margin: 9px 12px; padding: 6px 10px;
          background: #0e0e10; border: 1.5px solid var(--edge); color: #6fe08a;
          font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; }
        .leg-status.touring { color: var(--hi); }
        .leg-live { width: 7px; height: 7px; border-radius: 50%; background: #6fe08a; flex: none; animation: leg-pulse 2.2s ease-out infinite; }
        .leg-status.touring .leg-live { background: var(--hi); }
        @keyframes leg-pulse { 0% { box-shadow: 0 0 0 0 rgba(111,224,138,0.5); } 70% { box-shadow: 0 0 0 6px rgba(111,224,138,0); } 100% { box-shadow: 0 0 0 0 rgba(111,224,138,0); } }
        /* .leg-live pulse is paused by the MOTION toggle (.no-motion), not prefers-reduced-motion */
        .leg-list { list-style: none; margin: 0; padding: 0; max-height: 46vh; overflow: auto; }
        .leg-list li + li { border-top: 1px solid var(--line); }
        .leg-li { display: flex; align-items: stretch; }
        .leg-li .leg { flex: 1; min-width: 0; }
        .leg-ride { flex: none; width: 30px; background: none; border: 0; border-left: 1px solid var(--line); color: var(--ink-soft); cursor: pointer; font-size: 0.7rem; }
        .leg-ride:hover { background: var(--ink); color: var(--bg); }
        .leg-ride.on { background: var(--hi); color: var(--hi-ink); }
        .leg { display: grid; grid-template-columns: auto 15px auto 1fr auto; align-items: center; column-gap: 10px; width: 100%; background: none; border: 0; cursor: pointer; color: var(--ink); padding: 9px 14px; text-align: left; }
        .leg:hover, .leg-on { background: var(--ink); color: var(--bg); }
        .leg-no { font-size: 0.58rem; letter-spacing: 0.05em; color: var(--ink-soft); }
        .leg:hover .leg-no, .leg-on .leg-no { color: var(--bg); opacity: 0.7; }
        .leg-label { font-size: 1.02rem; letter-spacing: -0.01em; }
        .leg-blurb { font-family: var(--font-sans); font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .leg-n { font-size: 0.62rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
        .leg:hover .leg-blurb, .leg-on .leg-blurb, .leg:hover .leg-n, .leg-on .leg-n { color: var(--bg); }
        /* a closed thread in the key: struck label + a muted 'closed' tag */
        .leg-dead .leg-label { text-decoration: line-through; text-decoration-thickness: 1px; opacity: 0.7; }
        .leg-closed { font-family: var(--font-sans); font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.08em; color: #b56565; white-space: nowrap; }
        .leg-dead:hover .leg-closed, .leg-dead.leg-on .leg-closed { color: var(--bg); }
        .leg .shape { width: 15px; height: 15px; }
        /* the station-features key — WMATA's little glyph legend, two-up and quiet */
        .leg-feats { margin: 0 14px; border-top: 1.5px solid var(--ink); padding: 8px 0 6px; }
        .leg-feats-h { font-size: 0.56rem; letter-spacing: 0.18em; color: var(--ink-soft); margin-bottom: 6px; }
        .leg-feats-list { list-style: none; margin: 0; padding: 0; display: grid;
          grid-template-columns: 1fr 1fr; gap: 5px 12px; font-size: 0.58rem; letter-spacing: 0.04em; color: var(--ink-soft); }
        .leg-feats-list li { display: flex; align-items: center; gap: 6px; }
        .lf-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--st-dot, var(--ink)); flex: none; }
        .lf-xfer { width: 13px; height: 13px; border-radius: 50%; background: #fff;
          border: 2.5px solid var(--st-dot, var(--ink)); flex: none; }
        .lf-closed { color: var(--signal, #b56565); font-size: 0.78rem; line-height: 1; }
        .legend-ctl { display: flex; gap: 6px; margin: 0 14px; border-top: 1.5px solid var(--ink); padding: 10px 0 0; }
        .legend-ctl + .legend-ctl { border-top: 0; padding-top: 6px; }
        .colophon { color: var(--ink-soft); font-size: 0.5rem; letter-spacing: 0.14em; opacity: 0.7; padding: 10px 14px 12px; display: flex; align-items: center; gap: 7px; }
        /* the discoverable owl — dim by default, glows on hover / when lit; taps toggle night-owl */
        .owl-egg { margin-left: auto; background: none; border: 0; padding: 2px; font-size: 0.9rem; line-height: 1; cursor: pointer; opacity: 0.75; transition: opacity 0.15s, filter 0.15s, transform 0.15s; }
        .owl-egg:hover, .owl-egg:focus-visible { opacity: 1; filter: drop-shadow(0 0 4px rgba(150,190,255,0.8)); transform: scale(1.22) rotate(-8deg); }
        .owl-egg.lit { opacity: 1; filter: drop-shadow(0 0 5px rgba(150,190,255,0.9)); }
        .owl-toast { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 40;
          background: #0b0a1e; color: #ece9ff; border: 1px solid rgba(180,170,255,0.35);
          box-shadow: 0 0 22px rgba(120,110,240,0.35); padding: 10px 16px; font-size: 0.62rem;
          letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; pointer-events: none; }
        :global(.tt) { font-family: var(--font-sans); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; background: none; border: 2px solid var(--ink); color: var(--ink); padding: 5px 8px; cursor: pointer; }
        :global(.tt:hover) { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        :global(.tt.on) { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        /* touch feedback — no hover on phones, so mirror the invert/press onto :active */
        @media (hover: none), (pointer: coarse) {
          .leg:active { background: var(--ink); color: var(--bg); }
          .leg:active .leg-no, .leg:active .leg-blurb, .leg:active .leg-n { color: var(--bg); }
          .leg-ride:active { background: var(--ink); color: var(--bg); }
          .start-here:active, .open-index:active { transform: translate(1px, 1px); box-shadow: 2px 2px 0 rgba(0,0,0,0.3); }
          :global(.tt:active) { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        }
        @media (max-width: 700px) {
          :global(.mini) { display: none !important; }
          .masthead { top: 12px; right: 12px; }
          .brandmark { font-size: 1.3rem; }
          .bm-net, .mast-desc { display: none; }
          .hud-tl { top: 12px; left: 12px; gap: 8px; }
          .tag { display: none; }
          .hud-actions { gap: 5px; flex-wrap: wrap; }
          .hud-about { display: none; } /* About is still reachable via the masthead brandmark */
          .open-index, .start-here { font-size: 0.55rem; padding: 6px 8px; border-width: 2px; box-shadow: 3px 3px 0 rgba(0,0,0,0.3); }
          .open-index .mono { display: none; }
          /* legend clears the 44px controls column (right:18 + 44 ≈ 62) and collapses to a tap bar */
          .legend { left: 12px; right: 66px; bottom: 12px; width: auto; max-width: none; }
          .legend-head { cursor: pointer; align-items: center; }
          .legend-chev { display: inline; }
          .legend.min .legend-head { border-bottom: 0; }
          .legend.min .leg-status,
          .legend.min .leg-list,
          .legend.min .leg-feats,
          .legend.min .legend-ctl,
          .legend.min .legend-links,
          .legend.min .colophon { display: none; }
          .leg-blurb { display: none; }
          .leg-list { max-height: 34vh; }
          .leg { padding: 12px 14px; } /* bigger tap targets */
          .leg-ride { width: 44px; font-size: 0.85rem; }
          .leg-status, .colophon { display: none; }
          .legend-links { flex-wrap: wrap; }
          .onboard { top: 108px; bottom: auto; left: 12px; right: 12px; width: auto; transform: none; } /* clear the HUD row + the departure bar below it */
        }
      `}</style>
    </div>
  );
}
