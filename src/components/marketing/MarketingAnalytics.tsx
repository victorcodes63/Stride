'use client';

import Script from 'next/script';

const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

/** Lightweight marketing analytics — off unless env is set (RAV-52). */
export function MarketingAnalytics() {
  if (!plausibleDomain && !gaId) return null;

  return (
    <>
      {plausibleDomain ? (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      ) : null}
      {gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="stride-ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      ) : null}
    </>
  );
}
