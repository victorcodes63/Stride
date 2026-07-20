'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS, DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import {
  SalesDrawer,
  SalesEmptyState,
  SalesFilterBar,
  type FilterSelect,
} from '@/components/dashboard/sales';
import { formatRelativeTime } from '@/lib/sales/format';
import {
  apiFetch,
  salesKeys,
  useSalesMutation,
  useSalesResource,
} from '@/lib/sales/hooks';

type Contact = {
  id: string;
  accountsClientId: string;
  accountsClient: { id: string; name: string } | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isDecisionMaker: boolean;
  lastContactedAt: string | null;
  notes: string | null;
};

type ContactsResponse = { contacts: Contact[] };
type ClientsResponse = { clients: Array<{ id: string; name: string }> };

type ContactFormValues = {
  accountsClientId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isDecisionMaker: boolean;
  notes: string;
};

const DECISION_MAKER_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'decision', label: 'Decision makers' },
  { value: 'other', label: 'Other contacts' },
];

export default function SalesContactsContent() {
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const contactsQuery = useSalesResource<ContactsResponse>(
    salesKeys.contacts(),
    '/api/sales/contacts',
  );
  const clientsQuery = useSalesResource<ClientsResponse>(
    [...salesKeys.all, 'accounts-clients'],
    '/api/accounts/clients',
  );

  const contacts = useMemo(() => contactsQuery.data?.contacts ?? [], [contactsQuery.data]);
  const clients = useMemo(() => clientsQuery.data?.clients ?? [], [clientsQuery.data]);

  const deleteMutation = useSalesMutation<unknown, string>(
    (contactId) => apiFetch(`/api/sales/contacts/${contactId}`, { method: 'DELETE' }),
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => {
        toast.success('Contact deleted.');
        setDeleteTarget(null);
      },
    },
  );

  const accountOptions = useMemo<FilterSelect['options']>(() => {
    const seen = new Map<string, string>();
    for (const c of contacts) {
      if (c.accountsClient) seen.set(c.accountsClient.id, c.accountsClient.name);
    }
    return [
      { value: 'all', label: 'All accounts' },
      ...[...seen.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (accountFilter !== 'all' && c.accountsClientId !== accountFilter) return false;
      if (roleFilter === 'decision' && !c.isDecisionMaker) return false;
      if (roleFilter === 'other' && c.isDecisionMaker) return false;
      if (!q) return true;
      return [c.name, c.title, c.email, c.phone, c.accountsClient?.name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [contacts, search, accountFilter, roleFilter]);

  const stats = useMemo(() => {
    const decisionMakers = contacts.filter((c) => c.isDecisionMaker).length;
    const accounts = new Set(contacts.map((c) => c.accountsClientId)).size;
    return { total: contacts.length, decisionMakers, accounts };
  }, [contacts]);

  const selects: FilterSelect[] = [
    {
      id: 'account',
      value: accountFilter,
      ariaLabel: 'Filter by account',
      options: accountOptions,
      onChange: setAccountFilter,
    },
    {
      id: 'role',
      value: roleFilter,
      ariaLabel: 'Filter by role',
      options: DECISION_MAKER_OPTIONS,
      onChange: setRoleFilter,
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setDrawerOpen(true);
  };

  const loading = contactsQuery.isLoading;
  const errorMsg = contactsQuery.isError ? contactsQuery.error.message : null;
  const hasAnyContacts = contacts.length > 0;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Contacts"
        description="Decision-makers and stakeholders at finance accounts, linked to pipeline deals."
        icon={Users}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add contact
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Total contacts" value={stats.total} />
        <StatCard icon={Star} label="Decision makers" value={stats.decisionMakers} />
        <StatCard icon={Building2} label="Accounts covered" value={stats.accounts} />
      </div>

      {errorMsg ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <ContactsSkeleton />
      ) : !hasAnyContacts ? (
        <SalesEmptyState
          icon={Users}
          title="No contacts yet"
          description="Add buyers and stakeholders for your finance accounts to build out Account 360."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create contact
            </button>
          }
        />
      ) : (
        <>
          <SalesFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, title, email, account…"
            selects={selects}
            resultCount={filtered.length}
          />

          {filtered.length === 0 ? (
            <SalesEmptyState
              icon={Users}
              title="No matching contacts"
              description="Try a different search term or clear the filters."
              compact
            />
          ) : (
            <div className={`overflow-x-auto ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Last contacted</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]">
                      <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">{c.name}</td>
                      <td className="px-4 py-3 text-[var(--dash-text-muted)]">{c.title ?? '—'}</td>
                      <td className="px-4 py-3">
                        {c.accountsClient ? (
                          <Link
                            href={`/dashboard/sales/accounts/${c.accountsClientId}`}
                            className="font-medium text-[var(--stride-coral)] hover:underline"
                          >
                            {c.accountsClient.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 text-[var(--dash-text-body)] hover:text-[var(--stride-coral)]"
                          >
                            <Mail className="h-3.5 w-3.5" /> {c.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 text-[var(--dash-text-body)] hover:text-[var(--stride-coral)]"
                          >
                            <Phone className="h-3.5 w-3.5" /> {c.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.isDecisionMaker ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20">
                            <Star className="h-3 w-3" /> Decision maker
                          </span>
                        ) : (
                          <span className="text-[var(--dash-text-muted)]">Contact</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                        {formatRelativeTime(c.lastContactedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            aria-label={`Edit ${c.name}`}
                            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            aria-label={`Delete ${c.name}`}
                            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ContactDrawer
        open={drawerOpen}
        editing={editing}
        clients={clients}
        onClose={() => setDrawerOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete contact"
        description={
          deleteTarget ? (
            <>
              Remove <span className="font-medium">{deleteTarget.name}</span>
              {deleteTarget.accountsClient ? ` from ${deleteTarget.accountsClient.name}` : ''}? This
              cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardPage>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className={`${DASHBOARD_STAT_CARD_CLASS} flex items-center gap-3`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-[var(--dash-text-muted)]">{label}</p>
        <p className="text-xl font-semibold text-[var(--dash-text-strong)]">
          {value.toLocaleString('en-KE')}
        </p>
      </div>
    </div>
  );
}

function ContactsSkeleton() {
  return (
    <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
      <div className="animate-pulse divide-y divide-[var(--dash-border)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-4 w-40 rounded bg-[var(--dash-surface-muted)]" />
            <div className="h-4 w-28 rounded bg-[var(--dash-surface-muted)]" />
            <div className="ml-auto h-4 w-24 rounded bg-[var(--dash-surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_FORM: ContactFormValues = {
  accountsClientId: '',
  name: '',
  title: '',
  email: '',
  phone: '',
  isDecisionMaker: false,
  notes: '',
};

function ContactDrawer({
  open,
  editing,
  clients,
  onClose,
}: {
  open: boolean;
  editing: Contact | null;
  clients: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ContactFormValues>(EMPTY_FORM);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (editing) {
      setForm({
        accountsClientId: editing.accountsClientId,
        name: editing.name,
        title: editing.title ?? '',
        email: editing.email ?? '',
        phone: editing.phone ?? '',
        isDecisionMaker: editing.isDecisionMaker,
        notes: editing.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM, accountsClientId: clients[0]?.id ?? '' });
    }
  }, [open, editing, clients]);

  const saveMutation = useSalesMutation<unknown, ContactFormValues>(
    (values) => {
      const payload = {
        accountsClientId: values.accountsClientId,
        name: values.name.trim(),
        title: values.title.trim() || undefined,
        email: values.email.trim() || undefined,
        phone: values.phone.trim() || undefined,
        isDecisionMaker: values.isDecisionMaker,
        notes: values.notes.trim() || undefined,
      };
      return editing
        ? apiFetch(`/api/sales/contacts/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch('/api/sales/contacts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => {
        toast.success(editing ? 'Contact updated.' : 'Contact created.');
        onClose();
      },
    },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!form.accountsClientId) {
      setErr('Select a finance account.');
      return;
    }
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    saveMutation.mutate(form, {
      onError: (error) => setErr(error.message),
    });
  };

  const set = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <SalesDrawer
      open={open}
      onClose={onClose}
      title={editing ? 'Edit contact' : 'New contact'}
      subtitle={editing?.accountsClient?.name}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="contact-form"
            disabled={saveMutation.isPending}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create contact'}
          </button>
        </div>
      }
    >
      <form id="contact-form" onSubmit={submit} className="space-y-4">
        <label className="block text-xs text-[var(--dash-text-muted)]">
          Finance account
          <StrideSelect
            value={form.accountsClientId}
            onChange={(value) => set('accountsClientId', value)}
            options={
              clients.length === 0
                ? [{ value: '', label: 'No accounts found' }]
                : clients.map((c) => ({ value: c.id, label: c.name }))
            }
            ariaLabel="Finance account"
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-[var(--dash-text-muted)]">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="block text-xs text-[var(--dash-text-muted)]">
          Title
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Procurement lead…"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Phone
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        </div>
        <label className="block text-xs text-[var(--dash-text-muted)]">
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-2.5 text-sm text-[var(--dash-text-strong)]">
          <input
            type="checkbox"
            checked={form.isDecisionMaker}
            onChange={(e) => set('isDecisionMaker', e.target.checked)}
            className="rounded border-[var(--dash-border)] text-[var(--stride-coral)]"
          />
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500" /> Decision maker
          </span>
        </label>
        {err ? <p className="text-xs text-red-600">{err}</p> : null}
      </form>
    </SalesDrawer>
  );
}
