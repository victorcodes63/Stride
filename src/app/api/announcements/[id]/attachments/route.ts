import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 4.5 * 1024 * 1024;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ attachments: [] });
    }
    const { id } = await params;
    try {
      const announcement = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const attachments = await ctx.run((tx) =>
        tx.announcementAttachment.findMany({
          where: ctx.where({ announcementId: announcement.id }),
          orderBy: { createdAt: 'desc' },
        }),
      );

      return NextResponse.json({
        attachments: attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          contentType: att.contentType,
          fileSize: att.fileSize,
          createdAt: att.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/announcements/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load attachments.' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    try {
      const announcement = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required.' }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: 'File is empty.' }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large (max 4.5MB).' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'attachment';
      const key = `announcements/${announcement.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}-${safeName}`;

      let fileUrl: string;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(key, buffer, {
          access: 'public',
          contentType: file.type || 'application/octet-stream',
        });
        fileUrl = blob.url;
      } else {
        const dir = path.join(process.cwd(), 'public', 'uploads', 'announcements', announcement.id);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, path.basename(key)), buffer);
        fileUrl = `/uploads/announcements/${announcement.id}/${path.basename(key)}`;
      }

      const attachment = await ctx.run((tx) =>
        tx.announcementAttachment.create({
          data: {
            organizationId: ctx.organizationId,
            announcementId: announcement.id,
            fileName: file.name,
            fileUrl,
            contentType: file.type || null,
            fileSize: file.size,
            uploadedByUserId: ctx.staff.id,
          },
        }),
      );

      await ctx.audit({
        action: 'announcement.attachment.create',
        entityType: 'Announcement',
        entityId: announcement.id,
        route: 'POST /api/announcements/[id]/attachments',
        metadata: { attachmentId: attachment.id, fileName: attachment.fileName },
      });

      return NextResponse.json(
        {
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          contentType: attachment.contentType,
          fileSize: attachment.fileSize,
          createdAt: attachment.createdAt.toISOString(),
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/announcements/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to upload attachment.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    const attachmentId = request.nextUrl.searchParams.get('attachmentId')?.trim();
    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required.' }, { status: 400 });
    }

    try {
      const attachment = await ctx.run((tx) =>
        tx.announcementAttachment.findFirst({
          where: ctx.where({ id: attachmentId, announcementId: id }),
        }),
      );
      if (!attachment) {
        return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
      }

      await ctx.run((tx) => tx.announcementAttachment.delete({ where: { id: attachment.id } }));

      await ctx.audit({
        action: 'announcement.attachment.delete',
        entityType: 'Announcement',
        entityId: id,
        route: 'DELETE /api/announcements/[id]/attachments',
        metadata: { attachmentId: attachment.id, fileName: attachment.fileName },
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/announcements/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete attachment.' }, { status: 500 });
    }
  });
}
