'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { InvoiceLineDraft } from '@/lib/accounts-invoice-line-draft';
import { invoiceLineDraftsToPayload } from '@/lib/accounts-invoice-line-draft';

type PreviewInput = {
  clientName: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  vatRateBps: number;
  paymentAccountId: string;
  notes: string;
  lines: InvoiceLineDraft[];
  previewInvoiceNumber?: number;
};

type Props = {
  draft: PreviewInput | null;
  className?: string;
};

export function InvoiceDraftPdfPreview({ draft, className = '' }: Props) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draft?.clientName?.trim()) {
      setError(null);
      setLoading(false);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPdfUrl(null);
      return;
    }

    const payloadLines = invoiceLineDraftsToPayload(draft.lines);
    if (payloadLines.length < 1) {
      setError(null);
      setLoading(false);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPdfUrl(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch('/api/accounts/invoices/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          clientName: draft.clientName,
          currency: draft.currency,
          issueDate: draft.issueDate,
          dueDate: draft.dueDate,
          vatRateBps: draft.vatRateBps,
          paymentAccountId: draft.paymentAccountId,
          notes: draft.notes.trim() || null,
          previewInvoiceNumber: draft.previewInvoiceNumber,
          lines: payloadLines,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Preview failed (${res.status})`);
          }
          return res.blob();
        })
        .then((blob) => {
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setPdfUrl(url);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Preview failed');
          setPdfUrl(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const canPreview = Boolean(draft?.clientName?.trim() && invoiceLineDraftsToPayload(draft.lines).length > 0);

  return (
    <section
      className={`dashboard-surface shadow-sm overflow-hidden flex flex-col min-h-0 lg:sticky lg:top-4 ${className}`}
    >
      <div className="border-b border-neutral-200/80 px-4 py-3 shrink-0 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary-700" strokeWidth={1.75} />
            Live PDF preview
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Matches the generated invoice — updates as you edit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden((v) => !v)}
          className="text-xs font-medium text-primary-800 hover:text-primary-900 inline-flex items-center gap-1 shrink-0"
        >
          {hidden ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </>
          )}
        </button>
      </div>

      {!hidden ? (
        <div className="relative flex-1 min-h-[min(72vh,880px)] bg-neutral-100">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Building preview…
            </div>
          ) : null}
          {!canPreview && !loading ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-500">
              Select a billing client and add at least one line with a description and amount to
              preview the PDF.
            </div>
          ) : null}
          {error ? (
            <div className="absolute inset-x-4 top-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {error}
            </div>
          ) : null}
          {pdfUrl && canPreview && !hidden ? (
            <iframe src={pdfUrl} title="Invoice draft preview" className="w-full h-full min-h-[inherit] border-0" />
          ) : null}
        </div>
      ) : (
        <p className="px-4 py-8 text-sm text-neutral-500 text-center">Preview hidden.</p>
      )}
    </section>
  );
}
