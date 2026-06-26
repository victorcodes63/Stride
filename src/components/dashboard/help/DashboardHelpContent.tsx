'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Loader2,
  MessageSquarePlus,
  Search,
  Ticket,
} from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { PlatformContentLoader } from '@/components/platform/PlatformContentLoader';
import {
  HELP_ARTICLE_CATEGORIES,
  HELP_ARTICLES,
  type HelpArticle,
} from '@/lib/support/help-articles';
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  SUPPORT_TICKET_STATUS_TONE,
} from '@/lib/support/ticket-labels';
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';

type TicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  createdAt: string;
  messageCount: number;
  messages?: Array<{
    id: string;
    authorType: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
};

type Tab = 'help' | 'tickets';

function statusChipClass(tone: (typeof SUPPORT_TICKET_STATUS_TONE)[SupportTicketStatus]) {
  switch (tone) {
    case 'success':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'warning':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200';
    case 'info':
      return 'bg-primary-500/15 text-primary-800 dark:text-primary-200';
    case 'muted':
      return 'bg-neutral-500/10 text-[var(--dash-text-muted)]';
    default:
      return 'bg-neutral-500/10 text-[var(--dash-text-muted)]';
  }
}

function CreateTicketForm({ onCreated }: { onCreated: (ticket: TicketSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('other');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, description, category, priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create ticket.');
      onCreated(data.ticket as TicketSummary);
      setOpen(false);
      setSubject('');
      setDescription('');
      setCategory('other');
      setPriority('medium');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Raise a support ticket
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="dashboard-surface space-y-4 border p-4 sm:p-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">New support ticket</h3>
        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
          Raven support receives this in the control plane — include module, entity, and steps to reproduce.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="dash-filter-select w-full"
            placeholder="Brief summary of the issue"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
            className="dash-filter-select w-full"
          >
            {Object.entries(SUPPORT_TICKET_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
            className="dash-filter-select w-full"
          >
            {Object.entries(SUPPORT_TICKET_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            className="dash-filter-select w-full resize-y"
            placeholder="What happened? What did you expect? Include page URL, entity, and any error text."
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit ticket
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TicketDetail({
  ticketId,
  onBack,
}: {
  ticketId: string;
  onBack: () => void;
}) {
  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load ticket.');
      setTicket(data.ticket as TicketSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply.');
      setReply('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <PlatformContentLoader label="Loading ticket" />;
  if (!ticket) {
    return (
      <div className="dashboard-surface border p-6 text-sm text-[var(--dash-text-muted)]">
        {error || 'Ticket not found.'}
        <button type="button" onClick={onBack} className="mt-3 text-primary-700 hover:text-primary-800">
          ← Back to tickets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        ← All tickets
      </button>
      <div className="dashboard-surface border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[var(--dash-text-faint)]">{ticket.ticketNumber}</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--dash-text-strong)]">{ticket.subject}</h3>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusChipClass(SUPPORT_TICKET_STATUS_TONE[ticket.status])}`}
          >
            {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--dash-text-muted)]">
          {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} · {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]} ·{' '}
          {new Date(ticket.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="dashboard-surface divide-y border">
        {(ticket.messages ?? []).map((msg) => (
          <div key={msg.id} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--dash-text-strong)]">
                {msg.authorName}
                {msg.authorType === 'support' ? (
                  <span className="ml-2 rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800 dark:text-primary-200">
                    Raven support
                  </span>
                ) : null}
              </p>
              <time className="text-xs text-[var(--dash-text-faint)]">
                {new Date(msg.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--dash-text-body)]">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' ? (
        <form onSubmit={sendReply} className="dashboard-surface space-y-3 border p-4 sm:p-5">
          <label className="block text-sm font-medium text-[var(--dash-text-strong)]">Add a reply</label>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="dash-filter-select w-full resize-y"
            placeholder="Provide more detail or answer a question from support…"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send reply
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function DashboardHelpContent() {
  const [tab, setTab] = useState<Tab>('help');
  const [query, setQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_ARTICLES;
    return HELP_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.body.some((p) => p.toLowerCase().includes(q)),
    );
  }, [query]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketError(null);
    try {
      const res = await fetch('/api/support/tickets');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tickets.');
      setTickets(data.tickets as TicketSummary[]);
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tickets') void loadTickets();
  }, [tab, loadTickets]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={CircleHelp}
        title="Help & support"
        description="Guidance for your workspace, plus direct access to Raven support when you need hands-on help."
      />

      <div className="flex flex-wrap gap-2 border-b border-[var(--dash-border-subtle)] pb-3">
        <button
          type="button"
          onClick={() => {
            setTab('help');
            setSelectedTicketId(null);
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'help'
              ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
              : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Help center
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('tickets');
            setSelectedArticle(null);
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'tickets'
              ? 'bg-primary-500/15 text-primary-800 dark:text-primary-200'
              : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
          }`}
        >
          <Ticket className="h-4 w-4" />
          My tickets
        </button>
      </div>

      {tab === 'help' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <DashboardPageSection title="Browse topics" description="Common questions for dashboard users.">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-text-faint)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help…"
                className="dash-filter-select w-full pl-9"
              />
            </div>
            <div className="space-y-2">
              {HELP_ARTICLE_CATEGORIES.map((category) => {
                const items = filteredArticles.filter((a) => a.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-faint)]">
                      {category}
                    </p>
                    <ul className="space-y-1">
                      {items.map((article) => (
                        <li key={article.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedArticle(article)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--dash-hover)] ${
                              selectedArticle?.id === article.id
                                ? 'border-primary-500/40 bg-primary-500/10'
                                : 'border-[var(--dash-border-subtle)]'
                            }`}
                          >
                            <span className="font-medium text-[var(--dash-text-strong)]">{article.title}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dash-text-faint)]" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </DashboardPageSection>

          <DashboardPageSection title="Article">
            {selectedArticle ? (
              <article className="dashboard-surface border p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--dash-text-faint)]">
                  {selectedArticle.category}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--dash-text-strong)]">{selectedArticle.title}</h3>
                <p className="mt-2 text-sm text-[var(--dash-text-muted)]">{selectedArticle.summary}</p>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--dash-text-body)]">
                  {selectedArticle.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--dash-border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('tickets');
                      setSelectedArticle(null);
                    }}
                    className="text-sm font-medium text-primary-700 hover:text-primary-800"
                  >
                    Still need help? Raise a ticket →
                  </button>
                </div>
              </article>
            ) : (
              <div className="dashboard-surface flex min-h-[240px] flex-col items-center justify-center border p-6 text-center">
                <BookOpen className="h-8 w-8 text-[var(--dash-text-faint)]" />
                <p className="mt-3 text-sm text-[var(--dash-text-muted)]">
                  Select a topic to read guidance tailored to your dashboard.
                </p>
              </div>
            )}
          </DashboardPageSection>
        </div>
      ) : (
        <div className="space-y-4">
          <CreateTicketForm
            onCreated={(ticket) => {
              setTickets((prev) => [ticket, ...prev]);
              setSelectedTicketId(ticket.id);
            }}
          />

          {selectedTicketId ? (
            <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
          ) : (
            <DashboardPageSection
              title="Your support tickets"
              description="Track requests sent to Raven. Replies from our team appear here."
            >
              {ticketsLoading ? (
                <PlatformContentLoader label="Loading tickets" />
              ) : ticketError ? (
                <p className="text-sm text-red-600">{ticketError}</p>
              ) : tickets.length === 0 ? (
                <div className="dashboard-surface border p-6 text-sm text-[var(--dash-text-muted)]">
                  No tickets yet. Use the form above to contact Raven support.
                </div>
              ) : (
                <ul className="divide-y rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)]">
                  {tickets.map((ticket) => (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-hover)]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] text-[var(--dash-text-faint)]">{ticket.ticketNumber}</p>
                          <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">{ticket.subject}</p>
                          <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
                            {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]} ·{' '}
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusChipClass(SUPPORT_TICKET_STATUS_TONE[ticket.status])}`}
                        >
                          {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardPageSection>
          )}
        </div>
      )}

      <aside className="dashboard-surface border px-4 py-3 text-sm text-[var(--dash-text-muted)]">
        Enterprise customers with a dedicated success manager can also reach out through your usual Raven channel.
        For sales and demos, visit{' '}
        <Link href="/contact" className="font-medium text-primary-700 hover:text-primary-800">
          Contact
        </Link>
        .
      </aside>
    </DashboardPage>
  );
}
