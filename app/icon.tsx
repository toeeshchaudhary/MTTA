import { ImageResponse } from 'next/og';

// Brand mark = the map's "origin" motif: a solid ink disc with an open aperture,
// on the whiteboard cream. Rendered as a 512² PNG (favicon + Android icon source).
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f1e9' }}>
        <div style={{ width: 300, height: 300, borderRadius: 300, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 118, height: 118, borderRadius: 118, background: '#f4f1e9' }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
