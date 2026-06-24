/**
 * Microsoft Graph calendar integration: create Teams/Outlook online meeting events
 * so invitees receive a calendar invite with Accept/Decline/Tentative and join link.
 * Uses same app registration as email (MS_* env). Requires Calendars.ReadWrite
 * application permission for the mailbox user.
 */

function getGraphConfig() {
  const tenantId = process.env.MS_TENANT_ID?.trim() || '';
  const clientId = process.env.MS_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim() || '';
  const mailbox =
    process.env.MS_GRAPH_MAILBOX?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    '';
  return {
    tenantId,
    clientId,
    clientSecret,
    mailbox,
    enabled: Boolean(tenantId && clientId && clientSecret && mailbox),
  };
}

export type CreateTeamsMeetingResult =
  | { ok: true; joinUrl: string; eventId?: string }
  | { ok: false; error: string };

/**
 * Create an Outlook/Teams online meeting event. The mailbox user is the organizer;
 * the candidate is added as required attendee. Microsoft sends a calendar invite
 * with Accept/Decline/Tentative and the join link.
 */
export async function createTeamsMeeting(params: {
  organizerMailbox: string;
  candidateEmail: string;
  candidateName: string;
  subject: string;
  start: Date;
  end: Date;
  body?: string;
}): Promise<CreateTeamsMeetingResult> {
  const graph = getGraphConfig();
  if (!graph.enabled) {
    return { ok: false, error: 'Microsoft Graph not configured (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_GRAPH_MAILBOX).' };
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${graph.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: graph.clientId,
        client_secret: graph.clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    }
  );

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    return { ok: false, error: `Graph token failed (${tokenRes.status}): ${body.slice(0, 200)}` };
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return { ok: false, error: 'Graph token response missing access_token.' };
  }

  const timeZone = process.env.TZ || 'Africa/Nairobi';
  const formatIso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '');
  const eventBody = {
    subject: params.subject,
    body: {
      contentType: 'HTML',
      content: params.body || `<p>${params.subject}</p><p>Please use the link in this invite to join the meeting.</p>`,
    },
    start: {
      dateTime: formatIso(params.start),
      timeZone,
    },
    end: {
      dateTime: formatIso(params.end),
      timeZone,
    },
    attendees: [
      {
        emailAddress: {
          address: params.candidateEmail,
          name: params.candidateName,
        },
        type: 'required',
      },
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  const createRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(params.organizerMailbox)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '');
    return { ok: false, error: `Graph create event failed (${createRes.status}): ${body.slice(0, 300)}` };
  }

  const event = (await createRes.json()) as {
    id?: string;
    onlineMeeting?: { joinUrl?: string };
    webLink?: string;
  };
  const joinUrl = event.onlineMeeting?.joinUrl || event.webLink || '';
  if (!joinUrl) {
    return { ok: false, error: 'Graph event created but no join URL in response. Ensure Calendars.ReadWrite and online meeting is enabled for the mailbox.' };
  }
  return { ok: true, joinUrl, eventId: event.id };
}
