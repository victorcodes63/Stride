import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { brandConfig } from '@/lib/brand.config';

export const alt = `${brandConfig.productName} — ${brandConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
          background: '#FBF8F4',
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
            borderBottom: '220px solid #FF5436',
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
            background: '#FF5436',
          }}
        />
        <p
          style={{
            marginTop: 28,
            fontSize: 40,
            fontWeight: 700,
            color: '#1A1714',
            lineHeight: 1.2,
            maxWidth: 760,
          }}
        >
          {brandConfig.tagline}
        </p>
        <p
          style={{
            marginTop: 16,
            fontSize: 26,
            color: '#8A8076',
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
