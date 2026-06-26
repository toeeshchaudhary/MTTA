'use client';
import type { Media } from '@/lib/content';
import VoiceMemo from './VoiceMemo';

export default function MediaBlock({ media }: { media: Media[] }) {
  if (!media?.length) return null;
  return (
    <div className="media">
      {media.map((m, i) => {
        if (m.type === 'audio') return <VoiceMemo key={i} src={m.src} caption={m.caption} />;
        if (m.type === 'image')
          return (
            <figure key={i} className="m-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.caption ?? ''} />
              {m.caption && <figcaption>{m.caption}</figcaption>}
            </figure>
          );
        return (
          <figure key={i} className="m-vid">
            <video src={m.src} controls playsInline />
            {m.caption && <figcaption>{m.caption}</figcaption>}
          </figure>
        );
      })}
      <style jsx>{`
        .media { display: flex; flex-direction: column; gap: 14px; margin: 18px 0; }
        .m-img img, .m-vid video { width: 100%; display: block; border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); }
        figure { margin: 0; }
        figcaption { font-family: var(--font-mono); font-size: 0.62rem; color: var(--ink-soft); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
      `}</style>
    </div>
  );
}
