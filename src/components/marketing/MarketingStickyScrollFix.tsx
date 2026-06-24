'use client';

import { useEffect } from 'react';

/** globals.css sets overflow-x:hidden on html/body, which breaks position:sticky. */
export function MarketingStickyScrollFix() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflowX;
    const prevBody = body.style.overflowX;

    html.style.overflowX = 'visible';
    body.style.overflowX = 'visible';

    return () => {
      html.style.overflowX = prevHtml;
      body.style.overflowX = prevBody;
    };
  }, []);

  return null;
}
