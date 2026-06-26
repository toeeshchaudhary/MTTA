// The tile layer — curated modules placed on the board, design-system style:
// aligned, hairline-framed, mono-labelled. No scrapbook mess.
import type { Pin } from '@/lib/content';

export default function Pins({ pins }: { pins: Pin[] }) {
  if (!pins?.length) return null;
  return (
    <g className="tiles" aria-hidden>
      {pins.map((p, i) => {
        const no = `T·${String(i + 1).padStart(2, '0')}`;
        return (
          <foreignObject key={p.id} x={p.x} y={p.y} width={p.w} height={p.h} style={{ overflow: 'visible' }}>
            <div className={`tile tile-${p.kind}`} style={{ width: p.w, height: p.h }}>
              {p.kind === 'photo' ? (
                <>
                  <div className="tile-frame">{p.src ? <img src={p.src} alt={p.caption || ''} draggable={false} /> : <span className="tile-ph" />}</div>
                  <div className="tile-meta">
                    <span className="tile-tag"><span className="tile-no">{no}</span>{p.tag || 'photo'}</span>
                    {p.caption && <span className="tile-cap">{p.caption}</span>}
                  </div>
                </>
              ) : (
                <>
                  <span className="tile-tag"><span className="tile-no">{no}</span>{p.tag || 'note'}</span>
                  <p>{p.text}</p>
                </>
              )}
            </div>
          </foreignObject>
        );
      })}
    </g>
  );
}
