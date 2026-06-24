'use client';

import type { CSSProperties, ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';

/** Matches tailwind `pub.*` tokens — keep in sync with tailwind.config.js */
export const PUB_ICON_PRIMARY = '#FF5436';
export const PUB_ICON_ACCENT = '#554D64';

export type PubDuotoneIconProps = {
  icon: ComponentType<IconProps>;
  size?: number;
  /** Foreground layer — defaults to pub primary teal */
  primaryColor?: string;
  /** Background duotone layer — defaults to pub ink */
  accentColor?: string;
  className?: string;
  /** Accessible label when the icon is meaningful */
  title?: string;
};

/**
 * Phosphor duotone icon using the public marketing palette.
 * Phosphor v2 only accepts `color`; the accent layer is styled via CSS.
 */
export function PubDuotoneIcon({
  icon: Icon,
  size = 32,
  primaryColor = PUB_ICON_PRIMARY,
  accentColor = PUB_ICON_ACCENT,
  className,
  title,
}: PubDuotoneIconProps) {
  return (
    <span
      className={`pub-duotone-icon inline-flex ${className ?? ''}`.trim()}
      style={
        {
          '--pub-duotone-primary': primaryColor,
          '--pub-duotone-accent': accentColor,
        } as CSSProperties
      }
    >
      <Icon
        weight="duotone"
        size={size}
        color={primaryColor}
        alt={title}
        aria-hidden={title ? undefined : true}
      />
    </span>
  );
}

export type PubFeatureItemProps = {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
};

export function PubFeatureCallout({ icon, title, description }: PubFeatureItemProps) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 pt-0.5">
        <PubDuotoneIcon icon={icon} size={28} />
      </div>
      <div>
        <p className="text-sm font-medium text-pub-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-pub-ink-muted">{description}</p>
      </div>
    </div>
  );
}

export function PubFeatureGrid({ items }: { items: PubFeatureItemProps[] }) {
  return (
    <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
      {items.map((item) => (
        <li key={item.title}>
          <PubFeatureCallout {...item} />
        </li>
      ))}
    </ul>
  );
}
