'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!station) return;
      if (e.key === 'Escape') { expanded ? onCollapse() : onClose(); }
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [station, expanded, hasPrev, hasNext, onPrev, onNext, onCollapse, onClose]);

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
        </>
      )}
    </AnimatePresence>
  );
}
