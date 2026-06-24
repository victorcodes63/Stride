'use client';

/**
 * Standard section title across the public site.
 * Label: small uppercase (e.g. "SERVICES") in secondary-600.
 * Title: main heading in primary-900.
 * Optional subtitle and hero variant for larger titles.
 */
type SectionTitleProps = {
  label: string;
  title: string;
  /** Optional second line for hero; shown in secondary-500 (or white/80 on dark) */
  titleLine2?: string;
  subtitle?: string;
  variant?: 'section' | 'hero' | 'dark';
  className?: string;
};

export default function SectionTitle({
  label,
  title,
  titleLine2,
  subtitle,
  variant = 'section',
  className = '',
}: SectionTitleProps) {
  const isHero = variant === 'hero';
  const isDark = variant === 'dark';
  const HeadingTag = isHero ? 'h1' : 'h2';
  const labelCls = isDark ? 'text-white/80' : 'text-secondary-600';
  const titleCls = isDark ? 'text-white' : 'text-primary-900';
  const line2Cls = isDark ? 'text-white/90' : 'text-secondary-500';
  const subtitleCls = isDark ? 'text-white/90' : 'text-neutral-600';
  return (
    <header className={`text-center ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${labelCls} mb-4`}>
        {label}
      </p>
      <HeadingTag className={`font-heading font-bold leading-tight tracking-tight ${titleCls} ${
        isHero
          ? 'text-4xl md:text-5xl lg:text-6xl mb-6'
          : 'text-3xl md:text-4xl mb-4'
      }`}>
        {title}
        {titleLine2 && (
          <span className={`block ${line2Cls} ${isHero ? 'mt-2' : 'mt-1'}`}>
            {titleLine2}
          </span>
        )}
      </HeadingTag>
      {subtitle && (
        <p className={`leading-relaxed max-w-3xl mx-auto ${subtitleCls} ${
          isHero ? 'text-lg md:text-xl' : 'text-base md:text-lg'
        }`}>
          {subtitle}
        </p>
      )}
    </header>
  );
}
