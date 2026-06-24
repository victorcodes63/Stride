'use client';

import { useRef, useState } from 'react';
import type { FleetTripDetail, FleetTripDocumentRow } from '@/lib/fleet-api';
import { FLEET_TRIP_DOCUMENT_LABELS, FLEET_TRIP_DOCUMENT_TYPES } from '@/lib/fleet-documents';

type Props = {
  tripId: string;
  documents: FleetTripDocumentRow[];
  onUpdated: (trip: FleetTripDetail) => void;
};

export function FleetTripDocumentsSection({ tripId, documents, onUpdated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>('pod');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('docType', docType);
      if (title.trim()) form.append('title', title.trim());

      const res = await fetch(`/api/fleet/trips/${tripId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Upload failed.');
      }
      onUpdated((await res.json()) as FleetTripDetail);
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-ink">Trip documents</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Delivery notes, transport permits, and signed proof of delivery (POD).
      </p>

      {documents.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{doc.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {doc.docTypeLabel}
                  {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''}
                  {' · '}
                  {new Date(doc.createdAt).toLocaleString()}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View file
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-neutral-500">No documents attached yet.</p>
      )}

      <form onSubmit={(e) => void handleUpload(e)} className="mt-6 border-t border-neutral-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Upload document</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fleet-doc-type" className="mb-1 block text-xs font-medium text-neutral-600">
              Type
            </label>
            <select
              id="fleet-doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            >
              {FLEET_TRIP_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FLEET_TRIP_DOCUMENT_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fleet-doc-title" className="mb-1 block text-xs font-medium text-neutral-600">
              Title (optional)
            </label>
            <input
              id="fleet-doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Signed POD — Mombasa delivery"
              className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700"
          />
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={uploading}
          className="mt-4 inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </section>
  );
}
