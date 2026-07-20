'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FileText,
  FolderOpen,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Rows3,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { apiFetch, useApiMutation, useApiResource } from '@/hooks/useApiResource';
import { useSortableTable } from '@/hooks/useSortableTable';

type DocRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  version: string | null;
  status: string;
  isPublic: boolean;
  department: string | null;
  tags: unknown;
  effectiveDate: string | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  total: number;
  published: number;
  archived: number;
  expiringSoon: number;
  expired: number;
};

type ListResponse = {
  documents: DocRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
};

type SortKey = 'title' | 'category' | 'department' | 'version' | 'effectiveDate' | 'expiryDate' | 'status';

type ViewMode = 'table' | 'cards';

const DOCS_KEY = 'company-documents';
const PAGE_SIZE = 20;

const CATEGORIES = ['Policy', 'Procedure', 'Template', 'Handbook', 'Form', 'Guideline', 'SOP', 'Manual', 'Other'];

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];

const CATEGORY_FORM_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Active (published + draft)' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_FORM_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const INPUT =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: string): DashStatusTone {
  switch (status) {
    case 'published':
      return 'success';
    case 'draft':
      return 'info';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Days-to-expiry banding for the expiry cell/badge. */
function expiryInfo(expiryDate: string | null): { label: string; tone: DashStatusTone } | null {
  if (!expiryDate) return null;
  const expiry = new Date(`${expiryDate}T00:00:00`).getTime();
  if (Number.isNaN(expiry)) return null;
  const now = Date.now();
  const days = Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: 'Expired', tone: 'danger' };
  if (days <= 60) return { label: `${days}d left`, tone: 'warning' };
  return null;
}

function isPdf(doc: DocRow): boolean {
  return (doc.mimeType ?? '').includes('pdf') || /\.pdf$/i.test(doc.fileName);
}

type UploadResult = {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
};

/** Two-step upload: POST the file with XHR so we can surface progress. */
function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/company-documents/upload');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as UploadResult);
      } else {
        reject(new Error((data.error as string) || 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export default function CompanyDocumentsContent() {
  const [view, setView] = useState<ViewMode>('table');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { sort, toggleSort, getSortDirection } = useSortableTable<SortKey>({
    key: 'title',
    direction: 'asc',
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocRow | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocRow | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [category, statusFilter, search, sort.key, sort.direction]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('sort', sort.key);
    params.set('dir', sort.direction);
    if (category) params.set('category', category);
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('q', search);
    return `/api/company-documents?${params.toString()}`;
  }, [page, sort.key, sort.direction, category, statusFilter, search]);

  const listQuery = useApiResource<ListResponse>(
    [DOCS_KEY, { page, sort: sort.key, dir: sort.direction, category, statusFilter, search }],
    listUrl,
    { placeholderData: (prev) => prev },
  );

  const documents = listQuery.data?.documents ?? [];
  const total = listQuery.data?.total ?? 0;
  const summary = listQuery.data?.summary ?? {
    total: 0,
    published: 0,
    archived: 0,
    expiringSoon: 0,
    expired: 0,
  };

  const invalidateKeys = [[DOCS_KEY]] as const;

  const archiveMutation = useApiMutation(
    (id: string) => apiFetch(`/api/company-documents/${id}`, { method: 'DELETE' }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Document archived.');
        setArchiveTarget(null);
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const restoreMutation = useApiMutation(
    (id: string) =>
      apiFetch(`/api/company-documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' }),
      }),
    {
      invalidateKeys,
      onSuccess: () => toast.success('Document restored.'),
      onError: (err) => toast.error(err.message),
    },
  );

  const hasActiveFilters = !!category || !!statusFilter || !!search;

  const listStatus = listQuery.isLoading
    ? 'loading'
    : listQuery.isError
      ? 'error'
      : documents.length
        ? 'success'
        : 'empty';

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('q', search);
    return params.toString();
  }, [category, statusFilter, search]);

  const exportHref = (format: string) =>
    `/api/company-documents/export?format=${format}${exportParams ? `&${exportParams}` : ''}`;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Company Documents"
        icon={FolderOpen}
        description="Policies, SOPs, handbooks, and shared company documents."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                { format: 'csv', label: 'Export CSV', href: exportHref('csv') },
                { format: 'xlsx', label: 'Export Excel', href: exportHref('xlsx') },
                { format: 'pdf', label: 'Export PDF', href: exportHref('pdf') },
              ]}
            />
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="btn-primary inline-flex shrink-0 items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Upload document
            </button>
          </div>
        }
      />

      <DashboardStatGrid columns={4}>
        <DashboardStatCard label="Total documents" value={summary.total} tone="primary" />
        <DashboardStatCard label="Published" value={summary.published} tone="success" />
        <DashboardStatCard
          label="Expiring soon"
          value={summary.expiringSoon}
          tone="warning"
          warn={summary.expiringSoon > 0}
          hint="Within 60 days"
        />
        <DashboardStatCard
          label="Expired"
          value={summary.expired}
          tone="warning"
          warn={summary.expired > 0}
        />
        <DashboardStatCard label="Archived" value={summary.archived} tone="violet" />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <DashboardTableSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search title, category, department…"
              />
            </div>
            <StrideSelect
              value={category}
              onChange={setCategory}
              options={CATEGORY_FILTER_OPTIONS}
              ariaLabel="Category"
              className="w-full lg:w-48"
            />
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              ariaLabel="Status"
              className="w-full lg:w-56"
            />
            <div className="inline-flex shrink-0 rounded-lg border border-neutral-300 bg-white p-0.5">
              <ViewToggleButton
                active={view === 'table'}
                onClick={() => setView('table')}
                icon={Rows3}
                label="Table"
              />
              <ViewToggleButton
                active={view === 'cards'}
                onClick={() => setView('cards')}
                icon={LayoutGrid}
                label="Cards"
              />
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setStatusFilter('');
                  setSearchInput('');
                }}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={listStatus}
          error={listQuery.error?.message}
          onRetry={() => void listQuery.refetch()}
          loading={<DashboardInlineLoading label="Loading documents…" />}
          empty={
            <DashboardTableEmpty
              icon={<FolderOpen className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No documents found"
              description="Upload policies, handbooks, and SOPs for your team, or adjust your filters."
            />
          }
        >
          {view === 'table' ? (
            <DashboardTableViewport minWidth={1000}>
              <DashboardTable>
                <thead>
                  <tr>
                    <SortableHeader label="Title" sortKey="title" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Category" sortKey="category" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Department" sortKey="department" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Version" sortKey="version" align="center" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Effective" sortKey="effectiveDate" align="center" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Expiry" sortKey="expiryDate" align="center" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Status" sortKey="status" align="center" getSortDirection={getSortDirection} onSort={toggleSort} />
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const expiry = expiryInfo(doc.expiryDate);
                    return (
                      <tr key={doc.id} className="hover:bg-neutral-50/60">
                        <td className="max-w-[280px]">
                          <p className="truncate font-medium text-neutral-900">{doc.title}</p>
                          <p className="truncate text-xs text-neutral-400">
                            {doc.fileName}
                            {doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''}
                          </p>
                        </td>
                        <td>{doc.category}</td>
                        <td>{doc.department || '—'}</td>
                        <td className="col-center tabular-nums">{doc.version ? `v${doc.version}` : '—'}</td>
                        <td className="col-center tabular-nums">{doc.effectiveDate || '—'}</td>
                        <td className="col-center tabular-nums">
                          {doc.expiryDate ? (
                            <span className="inline-flex items-center gap-1.5">
                              {doc.expiryDate}
                              {expiry ? (
                                <span className={dashStatusChip(expiry.tone)}>{expiry.label}</span>
                              ) : null}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="col-center">
                          <span className={dashStatusChip(statusTone(doc.status))}>
                            {STATUS_LABELS[doc.status] ?? doc.status}
                          </span>
                        </td>
                        <td className="col-right">
                          <RowActions
                            doc={doc}
                            onPreview={() => setPreviewDoc(doc)}
                            onEdit={() => setEditDoc(doc)}
                            onArchive={() => setArchiveTarget(doc)}
                            onRestore={() => restoreMutation.mutate(doc.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc, idx) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  index={idx}
                  onPreview={() => setPreviewDoc(doc)}
                  onEdit={() => setEditDoc(doc)}
                  onArchive={() => setArchiveTarget(doc)}
                  onRestore={() => restoreMutation.mutate(doc.id)}
                />
              ))}
            </div>
          )}
          <DashboardPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemLabel="documents"
          />
        </DashboardAsyncState>
      </DashboardTableCard>

      <DocumentFormModal
        mode="create"
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        invalidateKeys={invalidateKeys}
      />

      <DocumentFormModal
        mode="edit"
        open={!!editDoc}
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        invalidateKeys={invalidateKeys}
      />

      <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive document"
        description={
          archiveTarget
            ? `Archive “${archiveTarget.title}”? It will be hidden from the active library but can be restored later.`
            : ''
        }
        confirmLabel="Archive"
        tone="danger"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        onCancel={() => setArchiveTarget(null)}
      />
    </DashboardPage>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Rows3;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SortableHeader({
  label,
  sortKey,
  align,
  getSortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: 'center' | 'right';
  getSortDirection: (key: SortKey) => 'asc' | 'desc' | null;
  onSort: (key: SortKey) => void;
}) {
  const dir = getSortDirection(sortKey);
  const alignClass = align === 'center' ? 'col-center' : align === 'right' ? 'col-right' : '';
  return (
    <th className={alignClass}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold hover:text-primary-700"
      >
        {label}
        {dir === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : dir === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

function RowActions({
  doc,
  onPreview,
  onEdit,
  onArchive,
  onRestore,
}: {
  doc: DocRow;
  onPreview: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="inline-flex flex-nowrap items-center justify-end gap-1">
      <IconButton title="Preview" onClick={onPreview} icon={Eye} />
      <IconButton title="Edit" onClick={onEdit} icon={Pencil} />
      {doc.status === 'archived' ? (
        <IconButton title="Restore" onClick={onRestore} icon={ArchiveRestore} tone="primary" />
      ) : (
        <IconButton title="Archive" onClick={onArchive} icon={Trash2} tone="danger" />
      )}
    </div>
  );
}

function IconButton({
  title,
  onClick,
  icon: Icon,
  tone = 'neutral',
}: {
  title: string;
  onClick: () => void;
  icon: typeof Eye;
  tone?: 'neutral' | 'danger' | 'primary';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-600 hover:bg-red-50'
      : tone === 'primary'
        ? 'text-primary-700 hover:bg-primary-50'
        : 'text-neutral-500 hover:bg-neutral-100';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function DocumentCard({
  doc,
  index,
  onPreview,
  onEdit,
  onArchive,
  onRestore,
}: {
  doc: DocRow;
  index: number;
  onPreview: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const expiry = expiryInfo(doc.expiryDate);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="dashboard-stat-card flex flex-col gap-3 transition-colors hover:border-neutral-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
          <FileText className="h-5 w-5 text-primary-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-primary-900">{doc.title}</h3>
          {doc.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{doc.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
              {doc.category}
            </span>
            <span className={dashStatusChip(statusTone(doc.status))}>
              {STATUS_LABELS[doc.status] ?? doc.status}
            </span>
            {doc.version ? (
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                v{doc.version}
              </span>
            ) : null}
            {doc.department ? (
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                {doc.department}
              </span>
            ) : null}
            {expiry ? <span className={dashStatusChip(expiry.tone)}>{expiry.label}</span> : null}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-neutral-400">
        {doc.fileName}
        {doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''} · Updated{' '}
        {new Date(doc.updatedAt).toLocaleDateString()}
      </p>
      <div className="mt-auto flex items-center gap-1 border-t border-neutral-100 pt-2">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {doc.status === 'archived' ? (
          <button
            type="button"
            onClick={onRestore}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"
          >
            <ArchiveRestore className="h-3.5 w-3.5" /> Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Archive
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PreviewModal({ doc, onClose }: { doc: DocRow | null; onClose: () => void }) {
  return (
    <DashboardModal
      open={!!doc}
      onClose={onClose}
      title={doc?.title}
      description={doc ? `${doc.category}${doc.version ? ` · v${doc.version}` : ''}` : undefined}
      icon={<FileText className="h-5 w-5" />}
      size="xl"
      footer={
        doc ? (
          <>
            <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
              Open in new tab
            </a>
            <button type="button" className="btn-primary text-sm" onClick={onClose}>
              Close
            </button>
          </>
        ) : null
      }
    >
      {doc ? (
        isPdf(doc) ? (
          <iframe
            src={doc.filePath}
            title={doc.title}
            className="h-[70vh] w-full rounded-lg border border-neutral-200"
          />
        ) : (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center text-sm text-neutral-500">
            <FileText className="h-10 w-10 text-neutral-300" />
            <p>Preview isn’t available for this file type.</p>
            <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
              Open file
            </a>
          </div>
        )
      ) : null}
    </DashboardModal>
  );
}

type FormState = {
  title: string;
  description: string;
  category: string;
  department: string;
  version: string;
  effectiveDate: string;
  expiryDate: string;
  status: string;
  isPublic: boolean;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  category: 'Policy',
  department: '',
  version: '1.0',
  effectiveDate: '',
  expiryDate: '',
  status: 'published',
  isPublic: false,
};

function DocumentFormModal({
  mode,
  open,
  doc,
  onClose,
  invalidateKeys,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  doc?: DocRow | null;
  onClose: () => void;
  invalidateKeys: readonly (readonly unknown[])[];
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && doc) {
      setForm({
        title: doc.title,
        description: doc.description ?? '',
        category: doc.category || 'Policy',
        department: doc.department ?? '',
        version: doc.version ?? '',
        effectiveDate: doc.effectiveDate ?? '',
        expiryDate: doc.expiryDate ?? '',
        status: doc.status || 'published',
        isPublic: doc.isPublic,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setUpload(null);
    setUploadPct(null);
    setUploadError(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, mode, doc]);

  const createMutation = useApiMutation(
    (body: Record<string, unknown>) =>
      apiFetch<{ id: string }>('/api/company-documents', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Document uploaded.');
        onClose();
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const updateMutation = useApiMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/company-documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Document updated.');
        onClose();
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const handleFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setUploadError('Only PDF files are accepted.');
      return;
    }
    setUploadError(null);
    setUploadPct(0);
    try {
      const result = await uploadWithProgress(file, setUploadPct);
      setUpload(result);
      setForm((f) => ({ ...f, title: f.title || result.fileName.replace(/\.pdf$/i, '') }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setUploadPct(null);
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  const submit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!form.category.trim()) {
      toast.error('Category is required.');
      return;
    }
    if (mode === 'create') {
      if (!upload) {
        toast.error('Please upload a PDF file first.');
        return;
      }
      createMutation.mutate({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim(),
        filePath: upload.filePath,
        fileName: upload.fileName,
        fileSize: upload.fileSize || null,
        mimeType: upload.mimeType,
        department: form.department.trim() || null,
        version: form.version.trim() || null,
        effectiveDate: form.effectiveDate || null,
        expiryDate: form.expiryDate || null,
        isPublic: form.isPublic,
      });
    } else if (doc) {
      updateMutation.mutate({
        id: doc.id,
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          department: form.department.trim(),
          version: form.version.trim(),
          status: form.status,
          effectiveDate: form.effectiveDate,
          expiryDate: form.expiryDate,
          isPublic: form.isPublic,
        },
      });
    }
  };

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Upload document' : 'Edit document'}
      icon={mode === 'create' ? <Upload className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
      size="lg"
      dismissible={!submitting}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={submit}
            disabled={submitting || (mode === 'create' && !upload)}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'Save document' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'create' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">PDF file *</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging
                  ? 'border-primary-500 bg-primary-50/60'
                  : 'border-neutral-300 bg-neutral-50/40 hover:border-primary-400'
              }`}
            >
              <Upload className="h-6 w-6 text-primary-500" />
              {upload ? (
                <p className="text-sm font-medium text-emerald-700">Ready: {upload.fileName}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-neutral-700">
                    Drag &amp; drop a PDF here, or click to browse
                  </p>
                  <p className="text-xs text-neutral-400">PDF only, up to 10 MB</p>
                </>
              )}
              {uploadPct !== null && !upload ? (
                <div className="mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {uploadError ? <p className="mt-1 text-xs text-red-600">{uploadError}</p> : null}
          </div>
        ) : doc ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-neutral-700">
              <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
              <span className="truncate">{doc.fileName}</span>
            </span>
            <a
              href={doc.filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-primary-700 hover:underline"
            >
              Open
            </a>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title *" className="sm:col-span-2">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={INPUT}
              placeholder="Document title"
            />
          </Field>
          <Field label="Category *">
            <StrideSelect
              value={form.category}
              onChange={(v) => setForm((f) => ({ ...f, category: v }))}
              options={CATEGORY_FORM_OPTIONS}
              ariaLabel="Category"
              className="w-full"
            />
          </Field>
          <Field label="Department">
            <input
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              className={INPUT}
              placeholder="e.g. HR, Finance"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={INPUT}
              placeholder="Short summary"
            />
          </Field>
          <Field label="Version">
            <input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              className={INPUT}
              placeholder="1.0"
            />
          </Field>
          {mode === 'edit' ? (
            <Field label="Status">
              <StrideSelect
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={STATUS_FORM_OPTIONS}
                ariaLabel="Status"
                className="w-full"
              />
            </Field>
          ) : null}
          <Field label="Effective date">
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className={INPUT}
            />
          </Field>
          <Field label="Expiry date">
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              className={INPUT}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            Visible to all employees (public)
          </label>
        </div>
      </div>
    </DashboardModal>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
