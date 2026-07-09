import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Stride — Move your business forward';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CORAL = '#FF5436';
const PAPER = '#FBF8F4';
const INK = '#1A1714';
const INK_SUBTLE = '#8A8076';

export default async function Image() {
  const wordmarkSvg = await readFile(join(process.cwd(), 'public/brand/stride-wordmark.svg'));
  const wordmarkSrc = `data:image/svg+xml;base64,${wordmarkSvg.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 80px',
          background: PAPER,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            borderLeft: '220px solid transparent',
            borderBottom: `220px solid ${CORAL}`,
            opacity: 0.92,
          }}
        />
        <img
          src={wordmarkSrc}
          alt=""
          width={360}
          height={72}
          style={{ objectFit: 'contain', objectPosition: 'left' }}
        />
        <div
          style={{
            marginTop: 28,
            width: 72,
            height: 5,
            borderRadius: 3,
            background: CORAL,
          }}
        />
        <p
          style={{
            marginTop: 28,
            fontSize: 40,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.2,
            maxWidth: 760,
          }}
        >
          Move your business forward
        </p>
        <p
          style={{
            marginTop: 16,
            fontSize: 26,
            color: INK_SUBTLE,
            lineHeight: 1.35,
            maxWidth: 720,
          }}
        >
          Operations platform for East African businesses
        </p>
      </div>
    ),
    { ...size },
  );
}
