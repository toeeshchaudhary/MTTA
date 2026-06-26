// Renders the saved terrain features (water, parks, forest, sand, blocks)
// behind the transit lines. Authored in /admin, stored in content/terrain.json.

import { KIND_BY_ID, type TerrainFeature } from './terrain-kinds';

export default function Terrain({ features, opacity = 1 }: { features: TerrainFeature[]; opacity?: number }) {
  if (!features?.length) return null;
  return (
    <g className="terrain" opacity={opacity} aria-hidden>
      {features.map((f) => {
        const k = KIND_BY_ID[f.kind] ?? KIND_BY_ID.block;
        return (
          <g key={f.id}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={k.round} ry={k.round} fill={k.fill} stroke={k.stroke} strokeWidth={2} />
            {f.label && (
              <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="rgba(20,20,20,0.30)">
                {f.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
