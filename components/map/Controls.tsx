'use client';
import { useControls } from 'react-zoom-pan-pinch';

export default function Controls({ onIndex }: { onIndex?: () => void }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="controls">
      {onIndex && <button className="ctl" onClick={onIndex} aria-label="Search / index">⌕</button>}
      <button className="ctl" onClick={() => zoomIn()} aria-label="Zoom in">+</button>
      <button className="ctl" onClick={() => zoomOut()} aria-label="Zoom out">−</button>
      <button className="ctl" onClick={() => resetTransform()} aria-label="Reset view">⊙</button>
      <style jsx>{`
        .controls { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); z-index: 20; display: flex; flex-direction: column; gap: 6px; }
        .ctl {
          width: 44px; height: 44px; border: 3px solid var(--black, #141414); background: var(--cream, #efe9da); color: #141414;
          font-size: 1.3rem; font-weight: 800; cursor: pointer; border-radius: 0; line-height: 1;
          box-shadow: 3px 3px 0 #141414; transition: transform 0.06s;
        }
        .ctl:hover { background: #141414; color: #f4f1e9; }
        .ctl:focus-visible { outline: 3px solid var(--hi); outline-offset: 2px; }
        .ctl:active { transform: translate(3px, 3px); box-shadow: 0 0 0 #141414; }
      `}</style>
    </div>
  );
}
