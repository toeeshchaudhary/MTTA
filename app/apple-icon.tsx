import { ImageResponse } from 'next/og';

// iOS home-screen icon (180²) — same origin-aperture mark, sized for Apple touch.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f1e9' }}>
        <div style={{ width: 108, height: 108, borderRadius: 108, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 42, height: 42, borderRadius: 42, background: '#f4f1e9' }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
