'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { swipe } from '@/lib/sfx';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';
import MediaBlock from './media/MediaBlock';

type Props = {
  station: Station | null;
  code?: string;
  line: Line | null;
  expanded: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
};

export default function StationDrawer({ station, code, line, expanded, hasPrev, hasNext, onPrev, onNext, onExpand, onCollapse, onClose }: Props) {
  const [share, setShare] = useState(false);     // boarding-pass share sheet
  const [imgReady, setImgReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // reset the share sheet whenever the station changes / drawer closes
  useEffect(() => { setShare(false); }, [station?.id]);
  useEffect(() => { if (!share) { setImgReady(false); setCopied(false); } }, [share]);

  const shareUrl = station ? (typeof window !== 'undefined' ? `${window.location.origin}/s/${station.id}` : `/s/${station.id}`) : '';
  const passSrc = station ? `/s/${station.id}/opengraph-image` : '';

  const copyLink = async () => {
    swipe();   // MetroCard swipe (no-op unless sounds on)
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  const nativeShare = async () => {
    if (!station) return;
    swipe();
    if (navigator.share) { try { await navigator.share({ title: `${station.title} · toeesh.network`, text: `A stop on toeesh.network: ${station.title}`, url: shareUrl }); } catch {} }
    else copyLink();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!station) return;
      if (e.key === 'Escape') { if (share) { setShare(false); return; } expanded ? onCollapse() : onClose(); return; }
      if (share) return; // don't navigate stops while the share sheet is up
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [station, expanded, hasPrev, hasNext, onPrev, onNext, onCollapse, onClose, share]);

  return (
    <AnimatePresence>
      {station && line && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: expanded ? 1 : 0.5 }} exit={{ opacity: 0 }} onClick={() => (expanded ? onCollapse() : onClose())} />
          <motion.aside
            layout
            className={`drawer ${expanded ? 'full' : ''}`}
            style={{ ['--line-c' as string]: line.color }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ x: { type: 'spring', stiffness: 320, damping: 34 }, layout: { type: 'spring', stiffness: 260, damping: 30 } }}
            aria-label={station.title}
          >
            {/* colored theme band — the station's line color */}
            <div className="d-band" />

            <div className="d-inner">
              <div className="d-head">
                <span className="d-line mono">{code ? `${code} · ` : ''}● {line.label}{station.date ? ` · ${station.date}` : ''}</span>
                <div className="d-actions">
                  <button className="d-btn" onClick={() => setShare(true)} aria-label="Share this stop">⤴ share</button>
                  <button className="d-btn" onClick={expanded ? onCollapse : onExpand} aria-label={expanded ? 'Minimize' : 'Read more, full screen'}>
                    {expanded ? '⤡ minimize' : '⤢ read more'}
                  </button>
                  <button className="d-btn x" onClick={onClose} aria-label="Close">✕</button>
                </div>
              </div>

              <motion.h1 layout="position" className="d-title display">{station.title}</motion.h1>

              {expanded && <div className="d-watermark" aria-hidden="true">{line.label}</div>}

              <MediaBlock media={station.media} />

              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{station.body}</ReactMarkdown>
              </div>

              <div className="d-nav">
                <button disabled={!hasPrev} onClick={onPrev}>← prev stop</button>
                {!expanded && <button className="d-readmore" onClick={onExpand}>open full ⤢</button>}
                <button disabled={!hasNext} onClick={onNext}>next stop →</button>
              </div>
            </div>
          </motion.aside>

          {/* boarding-pass share sheet — previews the real OG ticket */}
          <AnimatePresence>
            {share && (
              <motion.div className="share-scrim" onClick={() => setShare(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <motion.div
                  className="share-card"
                  style={{ ['--line-c' as string]: line.color }}
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 12 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                >
                  <div className="share-head">
                    <span className="mono share-k">your boarding pass</span>
                    <button className="share-x" onClick={() => setShare(false)} aria-label="Close share">✕</button>
                  </div>
                  <div className={`share-pass ${imgReady ? 'ready' : ''}`}>
                    {!imgReady && <div className="share-loading mono">generating pass…</div>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={passSrc} alt={`Boarding pass for ${station.title}`} onLoad={() => setImgReady(true)} />
                  </div>
                  <div className="share-url mono">{shareUrl}</div>
                  <div className="share-acts">
                    <button className="share-btn primary" onClick={copyLink}>{copied ? '✓ copied' : '⧉ copy link'}</button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && <button className="share-btn" onClick={nativeShare}>⤴ share…</button>}
                    <a className="share-btn" href={passSrc} download={`${station.id}-boarding-pass.png`}>↓ save pass</a>
                    <a className="share-btn" href={passSrc} target="_blank" rel="noreferrer">↗ open</a>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
