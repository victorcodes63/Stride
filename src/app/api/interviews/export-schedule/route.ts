import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { APP_TIMEZONE, dateTimeNairobi } from '@/lib/timezone';
import { generateInterviewSchedulePdf } from '@/lib/interview-schedule-pdf';
import { brand } from '@/lib/brand';

const LOGO_PATH = brand.logoSrc.startsWith('/') ? brand.logoSrc : `/${brand.logoSrc}`;

const interviewScheduleInclude = {
  application: {
    include: { candidate: true, job: true },
  },
} satisfies Prisma.InterviewInclude;

type InterviewScheduleRow = Prisma.InterviewGetPayload<{
  include: typeof interviewScheduleInclude;
}>;

/**
 * GET /api/interviews/export-schedule?date=YYYY-MM-DD&jobId=xxx
 *   OR ?ids=id1,id2,id3 (export selected interviews only)
 * ?format=pdf — returns PDF for direct download
 * Default: returns HTML for viewing/printing
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') || '';
  const dateStr = searchParams.get('date') || '';
  const jobId = searchParams.get('jobId') || undefined;
  const formatPdf = searchParams.get('format') === 'pdf';

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    let interviews: InterviewScheduleRow[];

    if (idsParam.trim()) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Query "ids" must be a comma-separated list of interview IDs.' }, { status: 400 });
      }
      interviews = await prisma.interview.findMany({
        where: { id: { in: ids } },
        include: interviewScheduleInclude,
        orderBy: { scheduledAt: 'asc' },
      });
      // Preserve order of ids if needed (findMany returns in arbitrary order; we ordered by scheduledAt)
    } else {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: 'Query "date" (YYYY-MM-DD) or "ids" is required.' }, { status: 400 });
      }
      const dateStart = new Date(dateStr);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStr);
      dateEnd.setHours(23, 59, 59, 999);
      if (Number.isNaN(dateStart.getTime())) {
        return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
      }
      const where: { scheduledAt: { gte: Date; lte: Date }; application?: { jobId: string } } = {
        scheduledAt: { gte: dateStart, lte: dateEnd },
      };
      if (jobId?.trim()) where.application = { jobId: jobId.trim() };
      interviews = await prisma.interview.findMany({
        where,
        include: interviewScheduleInclude,
        orderBy: { scheduledAt: 'asc' },
      });
    }

    /** Day bounds in Nairobi so breaks match the same calendar day as interviews */
    const dayBounds = (day: string) => {
      const start = dateTimeNairobi(day, '00:00');
      const end = new Date(dateTimeNairobi(day, '23:59:59').getTime() + 999);
      return { start, end };
    };

    let breaks: { id: string; scheduledAt: Date; durationMinutes: number; label: string }[] = [];
    let effectiveJobId = jobId?.trim() ?? '';
    let effectiveDateStr = dateStr;

    if (idsParam.trim() && interviews.length > 0) {
      const first = interviews[0].application;
      effectiveJobId = first.jobId;
      effectiveDateStr = interviews[0].scheduledAt.toLocaleDateString('en-CA', {
        timeZone: APP_TIMEZONE,
      });
    }

    if (effectiveJobId && effectiveDateStr && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDateStr)) {
      const { start: bStart, end: bEnd } = dayBounds(effectiveDateStr);
      breaks = await prisma.interviewScheduleBreak.findMany({
        where: { jobId: effectiveJobId, scheduledAt: { gte: bStart, lte: bEnd } },
        orderBy: { scheduledAt: 'asc' },
        select: { id: true, scheduledAt: true, durationMinutes: true, label: true },
      });
    }

    type TimelineItem =
      | { kind: 'interview'; i: (typeof interviews)[0] }
      | { kind: 'break'; b: (typeof breaks)[0] };
    const timeline: TimelineItem[] = [
      ...interviews.map((i) => ({ kind: 'interview' as const, i })),
      ...breaks.map((b) => ({ kind: 'break' as const, b })),
    ].sort((a, b) => {
      const ta = a.kind === 'interview' ? a.i.scheduledAt.getTime() : a.b.scheduledAt.getTime();
      const tb = b.kind === 'interview' ? b.i.scheduledAt.getTime() : b.b.scheduledAt.getTime();
      return ta - tb;
    });

    const formatPositionLine = (title: string, company?: string | null) => {
      const t = title?.trim() || '—';
      const c = company?.trim();
      if (c) return `${t} | ${c}`;
      return t;
    };
    let positionTitle = '—';
    if (interviews.length > 0) {
      const job = interviews[0].application.job;
      positionTitle = formatPositionLine(job.title, job.company);
    } else if (breaks.length > 0 && effectiveJobId) {
      const job = await prisma.job.findUnique({
        where: { id: effectiveJobId },
        select: { title: true, company: true },
      });
      positionTitle = job ? formatPositionLine(job.title, job.company) : '—';
    }
    const scheduleDate =
      timeline.length > 0
        ? new Date(
            timeline[0].kind === 'interview'
              ? timeline[0].i.scheduledAt
              : timeline[0].b.scheduledAt
          ).toLocaleDateString('en-KE', { dateStyle: 'long', timeZone: APP_TIMEZONE })
        : dateStr
          ? new Date(dateStr).toLocaleDateString('en-KE', { dateStyle: 'long', timeZone: APP_TIMEZONE })
          : '—';
    const venue =
      interviews.length > 0 && interviews[0].locationOrLink?.trim()
        ? interviews[0].locationOrLink!.trim()
        : '—';

    const isMeetingUrl = (s: string | null | undefined) => {
      const t = s?.trim();
      return !!t && (t.startsWith('http://') || t.startsWith('https://'));
    };
    const hasAnyVirtualMeeting = interviews.some(
      (i) => i.type === 'video' && isMeetingUrl(i.locationOrLink)
    );

    /** Break rows: sentinel + title + time (one merged cell in HTML/PDF) */
    const BREAK_SENTINEL = '__BREAK__';
    const rows = timeline.map((item, index) => {
      if (item.kind === 'break') {
        const b = item.b;
        const start = b.scheduledAt;
        const durationMs = (b.durationMinutes ?? 15) * 60 * 1000;
        const end = new Date(start.getTime() + durationMs);
        const timeRange = `${start.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE })} – ${end.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE })}`;
        const title = (b.label?.trim() || 'Break').replace(/^Break:\s*/i, '');
        return [BREAK_SENTINEL, title, timeRange];
      }
      const i = item.i;
      const start = i.scheduledAt;
      const durationMs = (i.durationMinutes ?? 45) * 60 * 1000;
      const end = new Date(start.getTime() + durationMs);
      const timeRange = `${start.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE })} – ${end.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE })}`;
      const candidate = i.application.candidate;
      const fullName = `${candidate.firstName} ${candidate.lastName}`;
      const email = candidate.email ?? '—';
      const phone = candidate.phone?.trim() ?? '—';
      const meetingLink = hasAnyVirtualMeeting
        ? i.type === 'video' && isMeetingUrl(i.locationOrLink)
          ? i.locationOrLink!.trim()
          : '—'
        : null;
      const base: string[] = [`${index + 1}.`, fullName, email, phone, timeRange];
      if (hasAnyVirtualMeeting) base.push(meetingLink!);
      base.push('');
      return base;
    });

    const headers = ['No.', 'Candidate', 'Email', 'Phone', 'Time', ...(hasAnyVirtualMeeting ? ['Meeting link'] : []), 'Time in'];

    if (formatPdf) {
      const pdfBuffer = await generateInterviewSchedulePdf({
        positionTitle,
        scheduleDate,
        venue,
        headers,
        rows,
      });
      const pdfFilename = idsParam.trim()
        ? `interview-schedule-selected-${interviews.length}.pdf`
        : `interview-schedule-${dateStr}.pdf`;
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${pdfFilename}"`,
          'Content-Length': String(pdfBuffer.byteLength),
        },
      });
    }

    const pageTitle = `Interview Schedule – ${positionTitle} – Stride`;
    const logoFullUrl = request.nextUrl.origin + LOGO_PATH;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      font-size: 16px;
      line-height: 1.45;
      min-height: 100vh;
    }
    /* Centered column on screen and when printing */
    .schedule-document {
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
      padding: 16px 20px 24px;
      width: 100%;
    }
    .header { text-align: center; margin-bottom: 28px; }
    .logo { margin-bottom: 16px; }
    .logo img { max-width: 152px; height: auto; display: inline-block; }
    .schedule-title {
      font-size: 1.65rem;
      font-weight: 700;
      margin: 0 0 12px 0;
      color: #0B1D39;
    }
    .position {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #333;
      max-width: 100%;
      padding: 0 8px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .schedule-meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px 24px;
      flex-wrap: wrap;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 12px;
      padding: 0 2px;
      color: #555;
      font-size: 0.9375rem;
      line-height: 1.4;
    }
    .schedule-meta-bar .meta-date { text-align: left; flex: 1; min-width: 0; }
    .schedule-meta-bar .meta-venue { text-align: right; flex: 1; min-width: 0; }
    .schedule-meta-bar .label { font-weight: 600; color: #333; }
    .schedule-wrap {
      width: 100%;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 15px;
      border: 2px solid #000000;
    }
    table col.col-no { width: 6%; }
    table col.col-candidate { width: 15%; }
    table col.col-email { width: 19%; }
    table col.col-phone { width: 17%; }
    table col.col-time { width: 13%; }
    table col.col-meeting { width: 18%; }
    table col.col-timein { width: 12%; }
    th, td {
      border: 1px solid #000000 !important;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #0B1D39 !important;
      color: #ffffff !important;
      border-color: #000000 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    tbody tr:nth-child(even) { background: #f5f6f8; }
    tbody tr:hover { background: #eef0f3; }
    tbody tr.row-break { background: #fff9f0 !important; }
    tbody tr.row-break td { border-color: #000000 !important; text-align: center !important; vertical-align: middle !important; padding: 14px 16px !important; }
    .break-block { display: inline-block; text-align: center; max-width: 100%; }
    .break-block .break-title { font-weight: 700; font-size: 1.05rem; color: #0B1D39; margin: 0 0 6px 0; line-height: 1.35; }
    .break-block .break-time { font-weight: 600; font-size: 0.95rem; color: #444; margin: 0; letter-spacing: 0.02em; }
    td { word-wrap: break-word; overflow-wrap: break-word; }
    @media print {
      /*
       * Browsers often ignore @page margins (print dialog overrides).
       * Inset is applied on body in mm so padding survives print layout.
       */
      @page {
        size: auto;
        margin: 0;
      }
      html {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        background: #fff !important;
      }
      body {
        margin: 0 !important;
        /* Physical gutter on paper — same on left/right for balance */
        padding: 16mm 18mm 18mm 18mm !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: 0 !important;
        box-sizing: border-box !important;
        background: #fff !important;
        font-size: 15px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .schedule-document {
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      .header {
        margin-bottom: 20px;
      }
      .schedule-wrap {
        overflow: visible !important;
        width: 100% !important;
      }
      table {
        page-break-inside: auto;
        width: 100% !important;
      }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th {
        background: #0B1D39 !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <main class="schedule-document">
  <header class="header">
    <div class="logo"><img src="${escapeHtml(logoFullUrl)}" alt="${escapeHtml(brand.appName)}" width="152" /></div>
    <h1 class="schedule-title">Interview Schedule</h1>
    <p class="position">${escapeHtml(positionTitle)}</p>
  </header>
  <div class="schedule-wrap">
    <div class="schedule-meta-bar" aria-label="Schedule date and venue">
      <div class="meta-date"><span class="label">Date:</span> ${escapeHtml(scheduleDate)}</div>
      <div class="meta-venue"><span class="label">Venue:</span> ${escapeHtml(venue)}</div>
    </div>
    <table>
      <colgroup>
        <col class="col-no" />
        <col class="col-candidate" />
        <col class="col-email" />
        <col class="col-phone" />
        <col class="col-time" />
        ${hasAnyVirtualMeeting ? '<col class="col-meeting" />' : ''}
        <col class="col-timein" />
      </colgroup>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length ? rows.map((row) => {
          const colspan = hasAnyVirtualMeeting ? 7 : 6;
          if (row[0] === BREAK_SENTINEL) {
            const title = escapeHtml(String(row[1] ?? 'Break'));
            const time = escapeHtml(String(row[2] ?? ''));
            return `<tr class="row-break"><td colspan="${colspan}"><div class="break-block"><p class="break-title">${title}</p><p class="break-time">${time}</p></div></td></tr>`;
          }
          return `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`;
        }).join('') : `<tr><td colspan="${hasAnyVirtualMeeting ? 7 : 6}">No interviews scheduled.</td></tr>`}
      </tbody>
    </table>
  </div>
  </main>
</body>
</html>`;
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const filename = idsParam.trim()
    ? `interview-schedule-selected-${interviews.length}.html`
    : `interview-schedule-${dateStr}.html`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
  } catch {
    return NextResponse.json({ error: 'Failed to generate schedule.' }, { status: 500 });
  }
}
