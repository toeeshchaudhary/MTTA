'use client';
// The right-hand inspector: station "studio" / pin / terrain / threads+site editors.
// Extracted from the admin page; receives everything it needs as one props bundle so
// the page no longer carries ~130 lines of editor JSX.
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TERRAIN_KINDS, DEFAULT_ROUND, type TerrainKind, type TerrainFeature } from '@/components/map/terrain-kinds';
import { SHAPES, PALETTE, PIN_KINDS, GRID } from '@/components/admin/lib/constants';
import { isLight } from '@/components/admin/lib/geometry';
import type { Media, St, Ln, Pin, SiteMeta, PlayMeta, AboutLink } from '@/components/admin/types';

export type InspectorProps = {
  form: St | null; setForm: React.Dispatch<React.SetStateAction<St | null>>;
  lines: Ln[]; stations: St[]; pins: Pin[]; terrain: TerrainFeature[]; site: SiteMeta;
  selLn: string | null; setSelLn: (v: string | null) => void;
  selPinObj: Pin | null; selFeat: TerrainFeature | null;
  preview: boolean; setPreview: (v: boolean) => void;
  idClash: boolean; stLines: string[];
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  lnColor: (id: string) => string;
  upF: (patch: Partial<St>) => void;
  setPrimaryLine: (id: string) => void;
  toggleStLine: (id: string) => void;
  setMedia: (i: number, patch: Partial<Media>) => void;
  upload: (file: File) => void;
  uploadPin: (id: string, file: File) => void;
  wrapSel: (before: string, after?: string) => void;
  prefixLine: (p: string) => void;
  linesNear: (x: number, y: number, thr?: number) => string[];
  pushHistory: () => void;
  commitLines: (next: Ln[]) => void;
  saveStation: (s: St) => Promise<string | null>;
  delStation: (id: string) => void;
  closeForm: () => void;
  pendingLine: { id: string; prevPts: [number, number][] } | null;
  setPendingLine: (v: null) => void;
  setSelSt: (v: string | null) => void;
  commitPins: (next: Pin[]) => void; updPin: (id: string, patch: Partial<Pin>) => void; setSelPin: (v: string | null) => void;
  commitTerrain: (next: TerrainFeature[]) => void; updTerr: (id: string, patch: Partial<TerrainFeature>) => void; setSelTerr: (v: string | null) => void;
  addThread: () => void; moveThread: (id: string, dir: -1 | 1) => void; upLine: (patch: Partial<Ln>) => void;
  setTool: (t: 'select' | 'station' | 'track' | 'paint' | 'terrain' | 'note' | 'bulldoze') => void;
  setEditId: (v: string | null) => void; setTrack: (v: [number, number][]) => void;
  flash: (m: string) => void;
  setSite: React.Dispatch<React.SetStateAction<SiteMeta>>;
  commitSite: (next: SiteMeta) => void;
  setSiteAbout: (patch: Partial<SiteMeta['about']>) => void;
  setSiteLink: (i: number, patch: Partial<AboutLink>) => void;
  setSitePlay: (patch: Partial<PlayMeta>) => void;
};

export default function Inspector(p: InspectorProps) {
  const {
    form, setForm, lines, stations, pins, terrain, site, selLn, setSelLn, selPinObj, selFeat,
    preview, setPreview, idClash, stLines, bodyRef, lnColor, upF, setPrimaryLine, toggleStLine,
    setMedia, upload, uploadPin, wrapSel, prefixLine, linesNear, pushHistory, commitLines,
    saveStation, delStation, closeForm, pendingLine, setPendingLine, setSelSt, commitPins, updPin,
    setSelPin, commitTerrain, updTerr, setSelTerr, addThread, moveThread, upLine, setTool, setEditId,
    setTrack, flash, setSite, commitSite, setSiteAbout, setSiteLink, setSitePlay,
  } = p;
  // play (playful extras) toggles — commit the computed next so we never read stale state
  const PLAY_TOGGLES: { k: keyof PlayMeta; label: string; hint: string }[] = [
    { k: 'critters', label: 'track critters', hint: 'a subway rat scurries the lines (rare pizza-rat)' },
    { k: 'stationPulse', label: 'arrival pulse', hint: 'stops ping when a train dwells' },
    { k: 'expressTrain', label: 'express train', hint: 'a rare express blows through non-stop' },
    { k: 'serviceQuips', label: 'service quips', hint: 'witty messages on the departures board' },
    { k: 'sounds', label: 'sounds', hint: 'door chime on open/close, swipe on share' },
    { k: 'nightOwl', label: 'night-owl egg', hint: 'enable the Konami-code neon mode' },
  ];
  const togglePlay = (k: keyof PlayMeta) => commitSite({ ...site, play: { ...site.play, [k]: !site.play[k] } });
  return (
    <aside className={`adm-inspector scroll ${form ? 'wide' : ''}`} onDragOver={(e) => { if (form) e.preventDefault(); }} onDrop={(e) => { if (form && e.dataTransfer.files[0]) { e.preventDefault(); upload(e.dataTransfer.files[0]); } }}>
      {form ? (
        <div className="studio" style={{ borderLeftColor: lnColor(form.line) }}>
          <div className="studio-head">
            <span className="acc" style={{ background: lnColor(form.line) }} />
            <input className="title-in" value={form.title} placeholder="untitled stop" onChange={(e) => upF({ title: e.target.value })} />
            <div className="ed-act">
              <button className="tbtn sm solid" onClick={async () => { pushHistory(); if (pendingLine) { await commitLines(lines); setPendingLine(null); } const id = await saveStation(form); if (id) { setSelSt(id); setForm((f) => f ? { ...f, id } : f); } }}>save</button>
              {form.id && <button className="tbtn sm" onClick={() => { pushHistory(); delStation(form.id); closeForm(); }}>delete</button>}
              <button className="tbtn sm" onClick={closeForm}>✕</button>
            </div>
          </div>
          <div className="studio-meta">
            <label>primary thread<select value={form.line} onChange={(e) => setPrimaryLine(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
            <label>shape<select value={form.shape} onChange={(e) => upF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label>date<input value={form.date} placeholder="2026-06" onChange={(e) => upF({ date: e.target.value })} /></label>
            <label>id {idClash && <span className="warn">⚠ in use</span>}<input value={form.id} placeholder="auto from title" onChange={(e) => upF({ id: e.target.value })} /></label>
          </div>
          {lines.length > 1 && (() => {
            const near = linesNear(form.x, form.y);
            return (
              <div className="studio-lines">
                <span className="sl-h mono">on threads{stLines.length > 1 && <span className="sl-badge">joint · {stLines.length}</span>}</span>
                <div className="sl-chips">
                  {lines.map((l) => {
                    const on = stLines.includes(l.id), isPrimary = l.id === form.line, suggest = near.includes(l.id) && !on;
                    return (
                      <button key={l.id} type="button" className={`linechip ${on ? 'on' : ''} ${suggest ? 'suggest' : ''}`} style={{ borderColor: l.color }} onClick={() => toggleStLine(l.id)} title={isPrimary ? 'primary thread' : on ? 'on this thread — click to remove' : 'click to add this thread'}>
                        <span className="dot" style={{ background: l.color }} />{l.label}{isPrimary && <span className="sl-p">★</span>}{suggest && <span className="sl-cue">overlaps</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div className="studio-toolbar">
            <span className="md-tools">
              <button onClick={() => wrapSel('**')} title="bold"><b>B</b></button>
              <button onClick={() => wrapSel('*')} title="italic"><i>I</i></button>
              <button onClick={() => prefixLine('## ')} title="heading">H</button>
              <button onClick={() => prefixLine('- ')} title="list">•</button>
              <button onClick={() => wrapSel('[', '](https://)')} title="link">↗</button>
            </span>
            <span className="md-tools right">
              <label className="up" title="upload media">＋ media<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
              <button className={preview ? 'on' : ''} onClick={() => setPreview(!preview)} title="toggle preview">{preview ? 'split' : 'preview'}</button>
            </span>
          </div>
          <div className={`studio-body ${preview ? 'split' : ''}`}>
            <textarea ref={bodyRef} className="bodyta" value={form.body} placeholder="start writing… markdown — **bold**, ## heading, - lists, [links](url)" onChange={(e) => upF({ body: e.target.value })} />
            {preview && <div className="md-prev prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{form.body || '*nothing yet*'}</ReactMarkdown></div>}
          </div>
          {form.media.length > 0 && (
            <div className="studio-media">
              {form.media.map((m, i) => (
                <div className="med-row" key={i}>
                  {m.type === 'image' ? <img className="thumb" src={m.src} alt="" /> : <span className="thumb ico">{m.type === 'audio' ? '♪' : '▷'}</span>}
                  <div className="med-f"><select value={m.type} onChange={(e) => setMedia(i, { type: e.target.value as Media['type'] })}><option>audio</option><option>image</option><option>video</option></select><input value={m.src} onChange={(e) => setMedia(i, { src: e.target.value })} placeholder="/media/…" /><input value={m.caption || ''} onChange={(e) => setMedia(i, { caption: e.target.value })} placeholder="caption" /></div>
                  <button className="tbtn sm" onClick={() => upF({ media: form.media.filter((_, k) => k !== i) })}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="studio-foot mono">drop a file anywhere to upload · {form.id ? `editing ${form.id}.md` : 'new stop — unsaved'}</div>
        </div>
      ) : selPinObj ? (
        <div className="ed">
          <div className="ed-h"><span className="mono">pin · {selPinObj.kind}</span><div className="ed-act"><button className="tbtn sm" onClick={() => { commitPins(pins.filter((q) => q.id !== selPinObj.id)); setSelPin(null); }}>delete</button><button className="tbtn sm" onClick={() => setSelPin(null)}>✕</button></div></div>
          <label>kind<select value={selPinObj.kind} onChange={(e) => commitPins(pins.map((q) => (q.id === selPinObj.id ? { ...q, kind: e.target.value as Pin['kind'] } : q)))}>{PIN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
          <label>tag<input value={selPinObj.tag || ''} placeholder="e.g. ethos" onChange={(e) => updPin(selPinObj.id, { tag: e.target.value })} onBlur={() => commitPins(pins)} /></label>
          {selPinObj.kind === 'note' ? (
            <label>text<textarea className="bodyta" style={{ minHeight: 120 }} value={selPinObj.text || ''} placeholder="write the note…" onChange={(e) => updPin(selPinObj.id, { text: e.target.value })} onBlur={() => commitPins(pins)} /></label>
          ) : (
            <>
              <label>image src<input value={selPinObj.src || ''} placeholder="/media/…" onChange={(e) => updPin(selPinObj.id, { src: e.target.value })} onBlur={() => commitPins(pins)} /></label>
              <label className="tbtn sm" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>＋ upload image<input type="file" hidden onChange={(e) => e.target.files?.[0] && uploadPin(selPinObj.id, e.target.files[0])} /></label>
              <label>caption<input value={selPinObj.caption || ''} onChange={(e) => updPin(selPinObj.id, { caption: e.target.value })} onBlur={() => commitPins(pins)} /></label>
            </>
          )}
          <div className="row2"><label>width<input type="number" value={selPinObj.w} onChange={(e) => updPin(selPinObj.id, { w: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitPins(pins)} /></label><label>height<input type="number" value={selPinObj.h} onChange={(e) => updPin(selPinObj.id, { h: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitPins(pins)} /></label></div>
          <p className="mono dimk foot">drag the pin to move · grab a corner to resize · {pins.length} pins</p>
        </div>
      ) : selFeat ? (
        <div className="ed">
          <div className="ed-h"><span className="mono">land · {selFeat.kind}</span><div className="ed-act"><button className="tbtn sm" onClick={() => { commitTerrain(terrain.filter((q) => q.id !== selFeat.id)); setSelTerr(null); }}>delete</button><button className="tbtn sm" onClick={() => setSelTerr(null)}>✕</button></div></div>
          <label>kind<select value={selFeat.kind} onChange={(e) => { const next = terrain.map((f) => (f.id === selFeat.id ? { ...f, kind: e.target.value as TerrainKind } : f)); commitTerrain(next); }}>{TERRAIN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
          <label className="terr-round">corner roundness <span className="mono dimk" style={{ textTransform: 'none', letterSpacing: 0 }}>{selFeat.round ?? DEFAULT_ROUND}</span><input type="range" min={0} max={80} value={selFeat.round ?? DEFAULT_ROUND} onChange={(e) => updTerr(selFeat.id, { round: Number(e.target.value) })} onPointerUp={() => commitTerrain(terrain)} onKeyUp={() => commitTerrain(terrain)} /></label>
          <label>label <span className="dimk" style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span><input value={selFeat.label || ''} placeholder="e.g. the harbour" onChange={(e) => updTerr(selFeat.id, { label: e.target.value })} onBlur={() => commitTerrain(terrain)} /></label>
          <p className="mono dimk foot">{selFeat.points ? `${selFeat.points.length}-point polygon · roundness 0 = sharp corners · drag a point to reshape · double-click a point to remove` : 'rectangle · drag a corner to resize'} · drag the body to move · {terrain.length} pieces of land</p>
        </div>
      ) : (
        <div className="ed">
          <div className="ed-h"><span className="mono">threads</span><button className="tbtn sm solid" onClick={addThread}>＋ add</button></div>
          <ul className="thr">
            {lines.map((l, i) => (
              <li key={l.id} className={selLn === l.id ? 'on' : ''}>
                <div className="thr-row" onClick={() => setSelLn(selLn === l.id ? null : l.id)}>
                  <span className="dot" style={{ background: l.color }} /><b>{l.label}</b><span className="mono dimk">{l.blurb}</span>
                  <span className="thr-ord"><button onClick={(e) => { e.stopPropagation(); moveThread(l.id, -1); }} disabled={i === 0}>↑</button><button onClick={(e) => { e.stopPropagation(); moveThread(l.id, 1); }} disabled={i === lines.length - 1}>↓</button></span>
                </div>
                {selLn === l.id && (
                  <div className="thr-ed">
                    <label>name<input value={l.label} onChange={(e) => upLine({ label: e.target.value })} /></label>
                    <label>blurb<input value={l.blurb} onChange={(e) => upLine({ blurb: e.target.value })} /></label>
                    <div className="row2"><label>shape<select value={l.shape} onChange={(e) => upLine({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label><label>bullet<select value={l.text} onChange={(e) => upLine({ text: e.target.value })}><option value="#fff">white</option><option value="#111">black</option></select></label></div>
                    <div className="swrow">{PALETTE.map((c) => <button key={c} className={`sw ${l.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => upLine({ color: c, text: isLight(c) ? '#111' : '#fff' })} />)}<label className="cpick" title="custom colour"><input type="color" value={l.color} onChange={(e) => upLine({ color: e.target.value, text: isLight(e.target.value) ? '#111' : '#fff' })} /></label></div>
                    {l.pts && l.pts.length >= 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className="mono dimk" style={{ fontSize: '0.58rem', letterSpacing: '0.06em' }}>tunnels — tap a segment to send it underground</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {Array.from({ length: l.pts.length - 1 }, (_, si) => { const on = (l.under ?? []).includes(si); return (
                            <button key={si} title={`segment ${si + 1}`} onClick={() => { const cur = new Set(l.under ?? []); on ? cur.delete(si) : cur.add(si); upLine({ under: Array.from(cur).sort((a, b) => a - b) }); }}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', width: 24, height: 24, cursor: 'pointer', border: '2px solid var(--ed-ink)', borderStyle: on ? 'dashed' : 'solid', background: on ? 'var(--ed-ink)' : 'transparent', color: on ? 'var(--ed-face)' : 'var(--ed-ink)' }}>{si + 1}</button>
                          ); })}
                        </div>
                      </div>
                    )}
                    <div className="thr-act"><button className="tbtn sm solid" onClick={() => { setForm(null); setSelSt(null); setTool('station'); flash(`tap the ${l.label} line to add a stop on it`); }}>＋ stop here</button><button className="tbtn sm" onClick={() => { setForm(null); setSelSt(null); setTool('track'); setEditId(l.id); setTrack((l.pts as [number, number][]) ?? []); flash('drag nodes · ＋ to add · dbl-click to remove · finish'); }}>✎ re-route</button><button className="tbtn sm" onClick={() => { pushHistory(); commitLines(lines.filter((q) => q.id !== l.id)); setSelLn(null); }}>delete</button></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '2px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
            <div className="ed-h"><span className="mono">origin pill & about</span></div>
            <label>pill text<input value={site.originLabel} onChange={(e) => setSite((s) => ({ ...s, originLabel: e.target.value }))} onBlur={() => commitSite(site)} /></label>
            <label>pill cue <span className="dimk" style={{ textTransform: 'none', letterSpacing: 0 }}>(the about ↗ button)</span><input value={site.originCue} placeholder="about ↗" onChange={(e) => setSite((s) => ({ ...s, originCue: e.target.value }))} onBlur={() => commitSite(site)} /></label>
            <label>about · name<input value={site.about.name} onChange={(e) => setSiteAbout({ name: e.target.value })} onBlur={() => commitSite(site)} /></label>
            <label>about · role<textarea className="bodyta" style={{ minHeight: 54, resize: 'vertical' }} value={site.about.role} onChange={(e) => setSiteAbout({ role: e.target.value })} onBlur={() => commitSite(site)} /></label>
            <label>about · blurb<textarea className="bodyta" style={{ minHeight: 78, resize: 'vertical' }} value={site.about.blurb} onChange={(e) => setSiteAbout({ blurb: e.target.value })} onBlur={() => commitSite(site)} /></label>
            <div className="ed-h"><span className="mono">about · link buttons</span><button className="tbtn sm" onClick={() => commitSite({ ...site, about: { ...site.about, links: [...site.about.links, { label: 'link ↗', url: 'https://' }] } })}>＋ add</button></div>
            {site.about.links.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                <label>label<input value={l.label} onChange={(e) => setSiteLink(i, { label: e.target.value })} onBlur={() => commitSite(site)} /></label>
                <label>url<input value={l.url} onChange={(e) => setSiteLink(i, { url: e.target.value })} onBlur={() => commitSite(site)} /></label>
                <button className="tbtn sm" onClick={() => commitSite({ ...site, about: { ...site.about, links: site.about.links.filter((_, k) => k !== i) } })}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '2px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
            <div className="ed-h"><span className="mono">playful extras</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLAY_TOGGLES.map((t) => (
                <button key={t.k} className={`tbtn sm ${site.play[t.k] ? 'on' : ''}`} title={t.hint} onClick={() => togglePlay(t.k)}>
                  {site.play[t.k] ? '◉' : '○'} {t.label}
                </button>
              ))}
            </div>
            <label>service quips <span className="dimk" style={{ textTransform: 'none', letterSpacing: 0 }}>(one per line)</span>
              <textarea className="bodyta" style={{ minHeight: 92, resize: 'vertical' }} value={site.play.quips.join('\n')}
                onChange={(e) => setSitePlay({ quips: e.target.value.split('\n') })}
                onBlur={() => commitSite({ ...site, play: { ...site.play, quips: site.play.quips.filter((q) => q.trim()) } })} />
            </label>
          </div>
          <p className="mono dimk foot">{stations.length} stops · {lines.length} threads · dev-only writes</p>
        </div>
      )}
    </aside>
  );
}
