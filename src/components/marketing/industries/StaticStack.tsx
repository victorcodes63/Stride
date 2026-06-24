'use client';

import {
  CORE_CAPABILITIES,
  CORE_PACKS_EXPLAINER,
  VERTICAL_PACKS,
} from './industries-content';

const PACK_COUNT = VERTICAL_PACKS.length;

export function StaticStack() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col-reverse gap-2">
        <div className="rounded-xl border border-[var(--sc-line)] bg-[var(--sc-ink)] p-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">
            {CORE_PACKS_EXPLAINER.coreLabel}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CORE_CAPABILITIES.map((cap) => (
              <span
                key={cap}
                className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
        {VERTICAL_PACKS.map((pack, i) => (
          <div
            key={pack.id}
            className="rounded-xl border border-white/10 bg-[var(--sc-ink)] px-4 py-3 shadow-sm"
            style={{ marginLeft: `${i * 8}px`, marginRight: `${(PACK_COUNT - 1 - i) * 8}px` }}
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: pack.color }}
              aria-hidden
            />
            <span className="text-sm font-semibold text-[var(--sc-paper)]">{pack.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
