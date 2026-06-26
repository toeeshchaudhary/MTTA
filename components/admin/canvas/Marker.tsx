// Station marker — line shape, or an interchange disc (white, ink ring, colour tick per thread).
import { INK } from '@/components/admin/lib/constants';

export default function Marker({ shape, color, r = 15, sel = false, colors }: { shape: string; color: string; r?: number; sel?: boolean; colors?: string[] }) {
  const sw = sel ? 6 : 5;
  if (colors && colors.length >= 2) {
    const gap = 9, dotR = 5, start = -((colors.length - 1) * gap) / 2;
    return (<g><circle r={r + 5} fill="#fff" stroke={INK} strokeWidth={sw} />{colors.map((c, i) => <circle key={i} cx={start + i * gap} cy={0} r={dotR} fill={c} />)}</g>);
  }
  if (shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#fff" stroke={color} strokeWidth={sw} />;
  if (shape === 'triangle') { const h = r * 1.9; return <polygon points={`0,${-h * 0.6} ${r * 1.1},${h * 0.5} ${-r * 1.1},${h * 0.5}`} fill="#fff" stroke={color} strokeWidth={sw} strokeLinejoin="round" />; }
  if (shape === 'semi') return <path d={`M ${-r},${r * 0.55} A ${r},${r} 0 0 1 ${r},${r * 0.55} Z`} fill="#fff" stroke={color} strokeWidth={sw} strokeLinejoin="round" />;
  return <circle r={r} fill="#fff" stroke={color} strokeWidth={sw} />;
}
