import type { SupportTicket, SupportTicketCategory, SupportTicketPriority } from '@prisma/client';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function isSupportTicketSyncConfigured(): boolean {
  return Boolean(trimEnv('CONTROL_PLANE_URL') && trimEnv('CONTROL_PLANE_CUSTOMER_SLUG'));
}

type SyncTicketInput = {
  ticket: Pick<
    SupportTicket,
    | 'id'
    | 'ticketNumber'
    | 'subject'
    | 'description'
    | 'category'
    | 'priority'
    | 'reporterName'
    | 'reporterEmail'
    | 'organizationId'
  >;
  reporterUserId: string;
};

export async function pushSupportTicketToControlPlane(
  input: SyncTicketInput,
): Promise<string | null> {
  const baseUrl = trimEnv('CONTROL_PLANE_URL');
  const slug = trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
  if (!baseUrl || !slug) return null;

  const apiKey = trimEnv('CONTROL_PLANE_INSTANCE_API_KEY');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const instanceUrl =
    trimEnv('NEXT_PUBLIC_APP_URL') ??
    trimEnv('VERCEL_URL')?.replace(/^/, 'https://') ??
    'http://localhost:3000';

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/support-tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      slug,
      externalId: input.ticket.id,
      ticketNumber: input.ticket.ticketNumber,
      subject: input.ticket.subject,
      description: input.ticket.description,
      category: input.ticket.category as SupportTicketCategory,
      priority: input.ticket.priority as SupportTicketPriority,
      reporterName: input.ticket.reporterName,
      reporterEmail: input.ticket.reporterEmail,
      reporterUserId: input.reporterUserId,
      organizationId: input.ticket.organizationId,
      instanceUrl,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { ticketId?: string };
  return data.ticketId?.trim() || null;
}

export async function pushSupportMessageToControlPlane(input: {
  controlPlaneTicketId: string;
  externalId: string;
  authorName: string;
  body: string;
}): Promise<boolean> {
  const baseUrl = trimEnv('CONTROL_PLANE_URL');
  const slug = trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
  if (!baseUrl || !slug) return false;

  const apiKey = trimEnv('CONTROL_PLANE_INSTANCE_API_KEY');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v1/support-tickets/${encodeURIComponent(input.controlPlaneTicketId)}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        slug,
        externalId: input.externalId,
        authorName: input.authorName,
        body: input.body,
      }),
    },
  );

  return res.ok;
}

const CP_TO_PRODUCT_STATUS: Record<string, string> = {
  new: 'submitted',
  triage: 'acknowledged',
  in_progress: 'in_progress',
  waiting_on_customer: 'waiting_on_customer',
  resolved: 'resolved',
  closed: 'closed',
};

export async function pullSupportTicketFromControlPlane(input: {
  controlPlaneTicketId: string;
  ticketNumber: string;
}): Promise<{
  status: string;
  messages: Array<{ id: string; authorType: string; authorName: string; body: string; createdAt: string }>;
} | null> {
  const baseUrl = trimEnv('CONTROL_PLANE_URL');
  const slug = trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
  if (!baseUrl || !slug) return null;

  const apiKey = trimEnv('CONTROL_PLANE_INSTANCE_API_KEY');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/support-tickets/${encodeURIComponent(input.controlPlaneTicketId)}`);
  url.searchParams.set('slug', slug);

  const res = await fetch(url.toString(), { headers, cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    messages?: Array<{ id: string; authorType: string; authorName: string; body: string; createdAt: string; isInternal?: boolean }>;
  };

  return {
    status: CP_TO_PRODUCT_STATUS[data.status ?? ''] ?? data.status ?? 'submitted',
    messages: (data.messages ?? []).filter((m) => !m.isInternal),
  };
}
