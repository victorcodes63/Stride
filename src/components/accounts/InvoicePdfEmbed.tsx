'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  pdfUrl: string;
  title?: string;
  className?: string;
};

/** Inline PDF viewer — fetches with credentials (iframes are blocked by X-Frame-Options). */
export function InvoicePdfEmbed({ pdfUrl, title = 'Invoice PDF', className = '' }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    fetch(pdfUrl, { credentials: 'include', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data.error === 'string' ? data.error : `Failed to load PDF (${res.status})`,
          );
        }
        return res.blob();
      })
      .then((blob) => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [pdfUrl]);

  return (
    <section
      className={`dashboard-surface shadow-sm overflow-hidden flex flex-col min-h-0 min-w-0 ${className}`}
    >
      <div className="border-b border-neutral-200/80 px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold text-neutral-900 truncate">{title}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Generated PDF — matches download and print.</p>
      </div>
      <div className="relative flex-1 min-h-[min(72vh,720px)] bg-neutral-100">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading PDF…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-amber-800">
            {error}
          </div>
        ) : null}
        {blobUrl && !loading ? (
          <iframe src={blobUrl} title={title} className="w-full h-full min-h-[inherit] border-0" />
        ) : null}
      </div>
    </section>
  );
}
