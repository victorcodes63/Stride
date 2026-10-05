'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ArrowDown,
  ArrowUpRight,
  Bank,
  CaretDown,
  ChartLineUp,
  Check,
  Gear,
  Handshake,
  Kanban,
  Scales,
  ShoppingCart,
  SquaresFour,
  Truck,
  UsersThree,
} from '@phosphor-icons/react';
import { MARKETING_READINESS_META, MARKETING_ROUTES, PLATFORM_MODULES } from '@/lib/marketing-config';

const AREA_ICONS: Record<string, PhosphorIcon> = {
  'HR & Payroll': UsersThree,
  Finance: Bank,
  Procurement: ShoppingCart,
  'Legal & Documents': Scales,
  Projects: Kanban,
  'Admin & Operations': Gear,
  'Fleet & Logistics': Truck,
  'HR Outsourcing': Handshake,
  Sales: ChartLineUp,
};

/** Areas included on every plan; everything else is a plug-in. */
const CORE_AREAS = new Set(['HR & Payroll', 'Finance']);

type Area = (typeof PLATFORM_MODULES)[number];

function pad(index: number) {
  return String(index + 1).padStart(2, '0');
}

function AreaDetail({ area, index, tone }: { area: Area; index: number; tone: 'coral' | 'light' }) {
  const Icon = AREA_ICONS[area.name] ?? SquaresFour;
  const isCore = CORE_AREAS.has(area.name);
  const onCoral = tone === 'coral';
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className={`flex items-center gap-2 text-[32px] font-light leading-none tracking-[-0.04em] ${onCoral ? 'text-white' : 'text-[var(--sc-ink)]'}`}>
          <ArrowUpRight size={24} weight="light" aria-hidden />
          {pad(index)}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            onCoral ? 'bg-white/15 text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral-deep)]'
          }`}
        >
          {isCore ? 'Included on every plan' : 'Plug-in module'}
        </span>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Icon size={26} weight="duotone" aria-hidden className={onCoral ? 'text-white' : 'text-[var(--sc-coral)]'} />
        <h3 className={`text-[22px] font-medium tracking-[-0.02em] ${onCoral ? 'sc-on-ink text-white' : 'text-[var(--sc-ink)]'}`}>
          {area.name}
        </h3>
      </div>
      <p className={`mt-3 text-[15px] leading-[1.65] ${onCoral ? 'text-white/85' : 'text-[var(--sc-ink-muted)]'}`}>
        {area.headline}
      </p>

      <ul className="mt-7 space-y-3">
        {area.features.slice(0, 4).map((feature) => (
          <li key={feature} className={`flex items-start gap-3 text-[14px] leading-snug ${onCoral ? 'text-white' : 'text-[var(--sc-ink)]'}`}>
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                onCoral ? 'bg-white/20 text-white' : 'bg-[var(--sc-coral)]/15 text-[var(--sc-coral)]'
              }`}
            >
              <Check size={11} weight="bold" aria-hidden />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      {area.modules.length > 1 ? (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-8">
          {area.modules.slice(0, 8).map((chip) => (
            <span
              key={chip.key}
              className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                onCoral ? 'bg-white/15 text-white' : 'bg-[var(--sc-paper-2)] text-[var(--sc-ink)]'
              }`}
            >
              {chip.label}
            </span>
          ))}
          {area.modules.length > 8 ? (
            <span className={`px-1 py-1 text-[12px] ${onCoral ? 'text-white/70' : 'text-[var(--sc-ink-subtle)]'}`}>
              +{area.modules.length - 8} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={`${area.modules.length > 1 ? 'mt-6' : 'mt-auto'} flex flex-wrap items-center justify-between gap-4 border-t pt-5 ${
          onCoral ? 'border-white/20' : 'border-[var(--sc-line)]'
        }`}
      >
        <span className={`text-[13px] ${onCoral ? 'text-white/75' : 'text-[var(--sc-ink-subtle)]'}`}>
          {MARKETING_READINESS_META[area.readiness].label} · {area.modules.length} {area.modules.length === 1 ? 'module' : 'modules'} inside
        </span>
        <Link
          href={MARKETING_ROUTES.contact}
          className={`inline-flex items-center gap-1.5 text-[14px] font-semibold transition-opacity hover:opacity-80 ${
            onCoral ? 'text-white' : 'text-[var(--sc-coral)]'
          }`}
        >
          See it in a demo <span aria-hidden>→</span>
        </Link>
      </div>
    </>
  );
}

/**
 * Every product area as a row of vertical panels; the active one opens wide in coral.
 * Desktop opens on hover or focus; mobile is a stacked accordion.
 */
export function PlatformModuleAccordion() {
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState<number | null>(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateSoon = (index: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActive(index), 90);
  };
  const cancel = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <>
      {/* Desktop: horizontal panels */}
      <div className="hidden h-[620px] gap-2 lg:flex" onMouseLeave={cancel}>
        {PLATFORM_MODULES.map((area, index) => {
          const isActive = index === active;
          const Icon = AREA_ICONS[area.name] ?? SquaresFour;
          return (
            <div
              key={area.name}
              onMouseEnter={() => activateSoon(index)}
              className={`relative min-w-0 overflow-hidden rounded-[22px] transition-[flex-grow,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                  ? 'grow-[7] bg-[var(--sc-coral)] shadow-[0_30px_70px_-34px_rgba(230,62,34,0.7)]'
                  : 'grow bg-[var(--sc-paper-2)] hover:bg-[#EDEDF0]'
              }`}
              style={{ flexBasis: 0 }}
            >
              {isActive ? (
                <div
                  role="region"
                  aria-label={area.name}
                  className="flex h-full w-[520px] max-w-full flex-col p-8 [animation:platform-panel-in_0.5s_0.12s_both]"
                >
                  <AreaDetail area={area} index={index} tone="coral" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  aria-label={`Show ${area.name}`}
                  className="flex h-full w-full flex-col items-center justify-between px-2 py-7 text-[var(--sc-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--sc-coral)]"
                >
                  <span className="flex flex-col items-center gap-1 text-[var(--sc-ink-subtle)]">
                    <ArrowDown size={16} aria-hidden />
                    <span className="text-[20px] font-light tracking-[-0.02em] text-[var(--sc-ink)]">{pad(index)}</span>
                  </span>
                  <span className="flex flex-col items-center gap-3">
                    <span className="whitespace-nowrap text-[14px] font-medium [writing-mode:vertical-rl] rotate-180">
                      {area.name}
                    </span>
                    <Icon size={20} weight="duotone" aria-hidden className="text-[var(--sc-coral)]" />
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile and tablet: stacked accordion */}
      <div className="space-y-2 lg:hidden">
        {PLATFORM_MODULES.map((area, index) => {
          const open = mobileOpen === index;
          const Icon = AREA_ICONS[area.name] ?? SquaresFour;
          return (
            <div
              key={area.name}
              className={`overflow-hidden rounded-[18px] transition-colors ${open ? 'bg-[var(--sc-coral)]' : 'bg-[var(--sc-paper-2)]'}`}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setMobileOpen(open ? null : index)}
                className={`flex w-full items-center gap-3 px-5 py-4 text-left ${open ? 'text-white' : 'text-[var(--sc-ink)]'}`}
              >
                <span className={`w-7 text-[15px] font-light ${open ? 'text-white/80' : 'text-[var(--sc-ink-subtle)]'}`}>
                  {pad(index)}
                </span>
                <Icon size={20} weight="duotone" aria-hidden className={open ? 'text-white' : 'text-[var(--sc-coral)]'} />
                <span className="flex-1 text-[16px] font-medium">{area.name}</span>
                <CaretDown size={16} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open ? (
                <div className="flex flex-col px-5 pb-6 pt-1">
                  <AreaDetail area={area} index={index} tone="coral" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes platform-panel-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){[class*="platform-panel-in"]{animation:none!important}}`}</style>
    </>
  );
}
