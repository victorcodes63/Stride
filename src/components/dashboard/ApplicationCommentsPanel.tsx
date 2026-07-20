'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import type { ApplicationCommentItem } from '@/app/api/applications/[id]/comments/route';
import type { MentionUser } from '@/app/api/applications/mention-users/route';
import { toast } from '@/components/ui/toast';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string | null, email: string | null): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBody(body: string, mentionNames: string[]) {
  if (mentionNames.length === 0) return body;
  const re = new RegExp(`(@(?:${mentionNames.map(escapeRegex).join('|')}))`, 'g');
  const nameSet = new Set(mentionNames.map((n) => `@${n}`));
  return body.split(re).map((part, i) =>
    nameSet.has(part) ? (
      <span key={i} className="rounded bg-primary-50 px-0.5 font-medium text-primary-700">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ApplicationCommentsPanel({ applicationId }: { applicationId: string }) {
  const [comments, setComments] = useState<ApplicationCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>([]);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/applications/${applicationId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.items)) setComments(d.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/applications/mention-users')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.users)) setUsers(d.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, users]);

  const detectMention = useCallback((value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const match = /@([^\s@]*)$/.exec(upToCaret);
    setMentionQuery(match ? match[1] : null);
    setActiveIndex(0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const insertMention = (user: MentionUser) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const upToCaret = draft.slice(0, caret);
    const rest = draft.slice(caret);
    const newUpTo = upToCaret.replace(/@([^\s@]*)$/, `@${user.name} `);
    const next = newUpTo + rest;
    setDraft(next);
    setSelectedMentions((prev) => (prev.some((m) => m.id === user.id) ? prev : [...prev, user]));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = newUpTo.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery != null && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    const mentions = selectedMentions
      .filter((m) => body.includes(`@${m.name}`))
      .map((m) => m.id);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, mentions: [...new Set(mentions)] }),
      });
      if (!res.ok) throw new Error();
      const created: ApplicationCommentItem = await res.json();
      setComments((prev) => [...prev, created]);
      setDraft('');
      setSelectedMentions([]);
      setMentionQuery(null);
      if (mentions.length > 0) {
        toast.success(`Comment posted · ${mentions.length} person(s) notified`);
      }
    } catch {
      toast.error('Could not post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-neutral-500">
        <MessageSquare className="h-4 w-4" />
        Discussion
        {comments.length > 0 && (
          <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500">
            {comments.length}
          </span>
        )}
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading discussion…
        </div>
      ) : comments.length === 0 ? (
        <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
          No comments yet. Start the discussion and @mention a teammate.
        </p>
      ) : (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => {
            const mentionNames = c.mentions
              .map((id) => userNameById.get(id))
              .filter((n): n is string => !!n);
            return (
              <li key={c.id} className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                  {initials(c.authorName, c.authorEmail)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">{c.authorName || c.authorEmail}</span>{' '}
                    · {relativeTime(c.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">
                    {renderBody(c.body, mentionNames)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Add a comment… use @ to mention a teammate"
          className="w-full resize-y rounded-lg border border-neutral-200 p-3 pr-10 text-sm text-neutral-700 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !draft.trim()}
          className="absolute bottom-2.5 right-2.5 rounded-lg bg-primary-600 p-1.5 text-white hover:bg-primary-700 disabled:opacity-40"
          aria-label="Post comment"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>

        {mentionQuery != null && suggestions.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
            {suggestions.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === activeIndex ? 'bg-primary-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                    {initials(u.name, u.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-700">{u.name}</span>
                    <span className="block truncate text-xs text-neutral-400">{u.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">Press ⌘/Ctrl + Enter to post.</p>
    </div>
  );
}
