'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Building2,
  FileText,
  Handshake,
  Mail,
  Phone,
  Receipt,
  Star,
  Users,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS, DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { SalesEmptyState, SalesStageBadge } from '@/components/dashboard/sales';
import {
  formatCompactCurrency,
  formatRelativeTime,
  formatSalesCurrency,
  formatShortDate,
} from '@/lib/sales/format';
import { salesKeys, useSalesResource } from '@/lib/sales/hooks';

type AccountDeal = {
  id: string;
  name: string;
  stage: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  accountsInvoiceId: string | null;
  owner: { id: string; name: string | null } | null;
};

type AccountContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isDecisionMaker: boolean;
  lastContactedAt: string | null;
};

type AccountActivity = {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  createdAt: string;
  dealId: string;
  dealName: string | null;
  actor: { id: string; name: string | null } | null;
};

type AccountInvoice = {
  id: string;
  invoiceNumber: number;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  status: 'unpaid' | 'partial' | 'paid' | string;
  amount: number;
};

type AccountResponse = {
  account: {
    id: string;
    name: string;
    type: string;
    currency: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  kpis: {
    openPipelineValue: number;
    weightedPipelineValue: number;
    wonValue: number;
    openDealsCount: number;
    contactsCount: number;
    outstandingInvoiceTotal: number;
  };
  deals: AccountDeal[];
  contacts: AccountContact[];
  activities: AccountActivity[];
  invoices: AccountInvoice[];
};

type TabId = 'deals' | 'contacts' | 'activity' | 'invoices';

const INVOICE_STATUS_TONE: Record<string, string> = {
  unpaid: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20',
  partial: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
  paid: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
};

export default function Account360Content({ accountId }: { accountId: string }) {
  const [tab, setTab] = useState<TabId>('deals');

  const query = useSalesResource<AccountResponse>(
    salesKeys.account(accountId),
    `/api/sales/accounts/${accountId}`,
  );

  const data = query.data;
  const currency = data?.account.currency ?? 'KES';

  const tabs = useMemo(
    () => [
      { id: 'deals' as const, label: 'Deals', count: data?.deals.length ?? 0, icon: Handshake },
      { id: 'contacts' as const, label: 'Contacts', count: data?.contacts.length ?? 0, icon: Users },
      { id: 'activity' as const, label: 'Activity', count: data?.activities.length ?? 0, icon: Activity },
      { id: 'invoices' as const, label: 'Invoices', count: data?.invoices.length ?? 0, icon: Receipt },
    ],
    [data],
  );

  if (query.isError) {
    return (
      <DashboardPage>
        <BackLink />
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {query.error.status === 404 ? 'Account not found.' : query.error.message}
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <BackLink />
      <DashboardPageHeader
        title={query.isLoading ? 'Loading account…' : (data?.account.name ?? 'Account')}
        description="Account 360 — pipeline, contacts, activity and billing at a glance."
        icon={Building2}
        badges={
          data
            ? [
                { label: data.account.currency },
                { label: data.account.type, icon: FileText },
              ]
            : []
        }
      />

      {query.isLoading || !data ? (
        <Account360Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              label="Open pipeline"
              value={formatCompactCurrency(data.kpis.openPipelineValue, currency)}
              hint={`${data.kpis.openDealsCount} open deal${data.kpis.openDealsCount === 1 ? '' : 's'}`}
            />
            <KpiCard
              label="Weighted pipeline"
              value={formatCompactCurrency(data.kpis.weightedPipelineValue, currency)}
              hint="Probability-adjusted"
            />
            <KpiCard
              label="Won value"
              value={formatCompactCurrency(data.kpis.wonValue, currency)}
              hint="Closed won"
            />
            <KpiCard label="Contacts" value={data.kpis.contactsCount.toLocaleString('en-KE')} hint="On file" />
            <KpiCard
              label="Outstanding invoices"
              value={formatCompactCurrency(data.kpis.outstandingInvoiceTotal, currency)}
              hint="Unpaid + partial"
              tone={data.kpis.outstandingInvoiceTotal > 0 ? 'warn' : 'default'}
            />
          </div>

          <div className="flex flex-wrap gap-1 border-b border-[var(--dash-border)]">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-[var(--stride-coral)] text-[var(--stride-coral)]'
                      : 'border-transparent text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  <span className="rounded-full bg-[var(--dash-surface-muted)] px-1.5 text-[11px] text-[var(--dash-text-muted)]">
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {tab === 'deals' ? <DealsTab deals={data.deals} /> : null}
          {tab === 'contacts' ? <ContactsTab contacts={data.contacts} /> : null}
          {tab === 'activity' ? <ActivityTab activities={data.activities} /> : null}
          {tab === 'invoices' ? <InvoicesTab invoices={data.invoices} /> : null}
        </>
      )}
    </DashboardPage>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/sales/contacts"
      className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]"
    >
      <ArrowLeft className="h-4 w-4" /> Back to contacts
    </Link>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className={DASHBOARD_STAT_CARD_CLASS}>
      <p className="text-xs text-[var(--dash-text-muted)]">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--dash-text-strong)]'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--dash-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function DealsTab({ deals }: { deals: AccountDeal[] }) {
  if (deals.length === 0) {
    return (
      <SalesEmptyState icon={Handshake} title="No deals for this account" description="Deals in the pipeline linked to this account will appear here." compact />
    );
  }
  return (
    <div className={`overflow-x-auto ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
          <tr>
            <th className="px-4 py-3">Deal</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Prob.</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Close</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]">
              <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                {d.name}
                {d.accountsInvoiceId ? (
                  <span className="ml-2 text-[11px] text-emerald-600">· invoiced</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <SalesStageBadge stage={d.stage} />
              </td>
              <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                {formatSalesCurrency(d.value, d.currency)}
              </td>
              <td className="px-4 py-3 text-[var(--dash-text-muted)]">{d.probability}%</td>
              <td className="px-4 py-3 text-[var(--dash-text-muted)]">{d.owner?.name ?? '—'}</td>
              <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                {formatShortDate(d.expectedCloseDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContactsTab({ contacts }: { contacts: AccountContact[] }) {
  if (contacts.length === 0) {
    return (
      <SalesEmptyState
        icon={Users}
        title="No contacts yet"
        description="Add stakeholders from the Contacts page to link them to this account."
        action={
          <Link
            href="/dashboard/sales/contacts"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            Manage contacts
          </Link>
        }
        compact
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {contacts.map((c) => (
        <div key={c.id} className={`${DASHBOARD_SURFACE_CLASS} p-4`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-medium text-[var(--dash-text-strong)]">
                {c.name}
                {c.isDecisionMaker ? <Star className="h-3.5 w-3.5 text-amber-500" /> : null}
              </p>
              {c.title ? <p className="text-xs text-[var(--dash-text-muted)]">{c.title}</p> : null}
            </div>
            <Link
              href="/dashboard/sales/contacts"
              className="shrink-0 text-xs font-medium text-[var(--stride-coral)] hover:underline"
            >
              Edit
            </Link>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {c.email ? (
              <a
                href={`mailto:${c.email}`}
                className="flex items-center gap-1.5 text-[var(--dash-text-body)] hover:text-[var(--stride-coral)]"
              >
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </a>
            ) : null}
            {c.phone ? (
              <a
                href={`tel:${c.phone}`}
                className="flex items-center gap-1.5 text-[var(--dash-text-body)] hover:text-[var(--stride-coral)]"
              >
                <Phone className="h-3.5 w-3.5" /> {c.phone}
              </a>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-[var(--dash-text-muted)]">
            Last contacted {formatRelativeTime(c.lastContactedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ activities }: { activities: AccountActivity[] }) {
  if (activities.length === 0) {
    return (
      <SalesEmptyState icon={Activity} title="No recent activity" description="Calls, emails and meetings logged against this account's deals will show here." compact />
    );
  }
  return (
    <div className={`${DASHBOARD_SURFACE_CLASS} p-5`}>
      <ol className="relative space-y-5 border-l border-[var(--dash-border)] pl-5">
        {activities.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[1.55rem] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--stride-coral)] ring-4 ring-[var(--dash-surface-solid)]" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                {a.type}
              </span>
              <p className="font-medium text-[var(--dash-text-strong)]">{a.subject}</p>
              <span className="text-xs text-[var(--dash-text-muted)]">
                {formatRelativeTime(a.createdAt)}
              </span>
            </div>
            {a.body ? <p className="mt-1 text-sm text-[var(--dash-text-body)]">{a.body}</p> : null}
            <p className="mt-1 text-[11px] text-[var(--dash-text-muted)]">
              {a.dealName ? `${a.dealName}` : 'Deal'}
              {a.actor?.name ? ` · ${a.actor.name}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: AccountInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <SalesEmptyState icon={Receipt} title="No invoices" description="Finance invoices raised for this account will appear here." compact />
    );
  }
  return (
    <div className={`overflow-x-auto ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">Invoices</p>
        <Link
          href="/dashboard/accounts/invoices"
          className="text-xs font-medium text-[var(--stride-coral)] hover:underline"
        >
          Open in Finance →
        </Link>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
          <tr>
            <th className="px-4 py-3">Number</th>
            <th className="px-4 py-3">Issue date</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]">
              <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                #{inv.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-[var(--dash-text-muted)]">{formatShortDate(inv.issueDate)}</td>
              <td className="px-4 py-3 text-[var(--dash-text-muted)]">{formatShortDate(inv.dueDate)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
                    INVOICE_STATUS_TONE[inv.status] ?? INVOICE_STATUS_TONE.unpaid
                  }`}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-[var(--dash-text-strong)]">
                {formatSalesCurrency(inv.amount, inv.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Account360Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${DASHBOARD_STAT_CARD_CLASS} h-20`} />
        ))}
      </div>
      <div className={`${DASHBOARD_SURFACE_CLASS} h-64`} />
    </div>
  );
}
