/**
 * Hero atmosphere: a soft spotlight falling from the top, faint topographic
 * contours drifting very slowly, and fine film grain. Purely decorative.
 * All geometry is deterministic so server and client markup match.
 */

const VIEW_W = 1600;
const VIEW_H = 1000;

type Hill = { cx: number; cy: number; rings: number; step: number; seed: number };

/** Two "hills" give the contour field a natural, map-like overlap. */
const HILLS: Hill[] = [
  { cx: 1180, cy: 980, rings: 14, step: 46, seed: 1.7 },
  { cx: 320, cy: 1060, rings: 11, step: 52, seed: 4.2 },
];

function ringPath(cx: number, cy: number, radius: number, seed: number, index: number): string {
  const points = 96;
  let d = '';
  for (let i = 0; i <= points; i += 1) {
    const t = (i / points) * Math.PI * 2;
    // Layered sines make each ring irregular but smooth, like terrain.
    const wobble =
      Math.sin(t * 3 + seed + index * 0.35) * (radius * 0.06) +
      Math.sin(t * 5 + seed * 1.9 - index * 0.2) * (radius * 0.035) +
      Math.sin(t * 2 - seed * 0.7) * (radius * 0.05);
    const r = radius + wobble;
    const x = cx + Math.cos(t) * r * 1.35; // wider than tall, like a ridge
    const y = cy + Math.sin(t) * r;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

const CONTOURS: { d: string; strong: boolean }[] = HILLS.flatMap((hill) =>
  Array.from({ length: hill.rings }, (_, index) => ({
    d: ringPath(hill.cx, hill.cy, 90 + index * hill.step, hill.seed, index),
    strong: index % 5 === 4, // every fifth line is an "index contour", like real maps
  })),
);

/** Tiny SVG noise tile for film grain. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const BACKGROUND_CSS = `
@keyframes stride-contour-drift {
  0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(-1.5%, -2%, 0) rotate(1.2deg) scale(1.03); }
  100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
}
@keyframes stride-spotlight-breathe {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
.stride-contours { animation: stride-contour-drift 60s ease-in-out infinite; transform-origin: 60% 80%; }
.stride-spotlight { animation: stride-spotlight-breathe 9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .stride-contours, .stride-spotlight { animation: none; }
}
`;

export function HomeHeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <style>{BACKGROUND_CSS}</style>

      {/* Topographic contours, fading out towards the edges and the top. */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: 'radial-gradient(ellipse 85% 75% at 55% 70%, black 10%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 55% 70%, black 10%, transparent 75%)',
        }}
      >
        {/* Centring lives on the wrapper; the drift animation owns the svg's transform. */}
        <div className="absolute inset-y-0 left-1/2 w-full min-w-[1600px] -translate-x-1/2">
        <svg
          className="stride-contours h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          {CONTOURS.map((contour, index) => (
            <path
              key={index}
              d={contour.d}
              stroke="white"
              strokeOpacity={contour.strong ? 0.11 : 0.05}
              strokeWidth={contour.strong ? 1.1 : 0.8}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        </div>
      </div>

      {/* Spotlight: a soft cone of warm light from the top centre. */}
      <div className="stride-spotlight absolute inset-0">
        <div
          className="absolute left-1/2 top-[-12%] h-[95%] w-[min(1100px,120vw)] -translate-x-1/2 blur-[50px]"
          style={{
            clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
            background:
              'linear-gradient(to bottom, rgba(255,236,226,0.16) 0%, rgba(255,120,90,0.08) 45%, rgba(255,84,54,0) 85%)',
          }}
        />
        <div className="absolute left-1/2 top-[-20rem] h-[40rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.2),rgba(255,84,54,0.05)_60%,transparent)]" />
        {/* The light source: a bright seam at the very top. */}
        <div className="absolute left-1/2 top-0 h-px w-[min(520px,70vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      {/* Film grain over everything. */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
      />
    </div>
  );
}
