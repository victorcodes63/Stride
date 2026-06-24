'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { MARKETING_DEMO_VIDEO } from '@/lib/marketing-config';

export function BookDemoVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const play = () => {
      video.play().catch(() => {});
    };

    const useMp4 = () => {
      video.src = MARKETING_DEMO_VIDEO.mp4;
      video.addEventListener('loadeddata', play, { once: true });
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = MARKETING_DEMO_VIDEO.hls;
      video.addEventListener('loadedmetadata', play, { once: true });
      video.addEventListener('error', useMp4, { once: true });
      return;
    }

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(MARKETING_DEMO_VIDEO.hls);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, play);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls?.destroy();
          hls = null;
          useMp4();
        }
      });
    } else {
      useMp4();
    }

    return () => {
      hls?.destroy();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
    />
  );
}
