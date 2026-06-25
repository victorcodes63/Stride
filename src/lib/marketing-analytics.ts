/** Client-side marketing conversion events (Plausible / GA4 when configured). */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackMarketingEvent(
  name: 'book_demo_submit' | 'nav_cta_click',
  props?: Record<string, string>,
) {
  if (typeof window === 'undefined') return;

  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {
    /* ignore */
  }

  try {
    window.gtag?.('event', name, props ?? {});
  } catch {
    /* ignore */
  }
}
