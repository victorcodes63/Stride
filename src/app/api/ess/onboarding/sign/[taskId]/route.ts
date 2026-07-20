import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  OnboardingSignatureStatus,
  OnboardingTaskStatus,
  OnboardingTaskType,
  WorkflowStatus,
} from '@prisma/client';
import { put } from '@vercel/blob';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { withEssTenant, type EssTenantContext } from '@/lib/ess-tenant-api';
import { maybeCompleteWorkflow, refreshWorkflowTaskSLAs } from '@/lib/onboarding-workflows';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

type RouteContext = { params: Promise<{ taskId: string }> };

/** Store a buffer to Vercel Blob when configured, else fall back to public/uploads. */
async function storeBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, { access: 'public', contentType });
    return blob.url;
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', path.dirname(key));
  await mkdir(dir, { recursive: true });
  const filePath = path.join(process.cwd(), 'public', 'uploads', key);
  await writeFile(filePath, buffer);
  return `/uploads/${key}`;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
  } catch {
    return null;
  }
}

/** Build a signed PDF embedding the acknowledgment, signature, and an audit trail. */
async function buildSignedPdf(input: {
  documentTitle: string;
  documentPath: string | null;
  signerName: string;
  signatureImage: { buffer: Buffer; mime: string } | null;
  signedAt: Date;
  ipAddress: string | null;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const marginX = 56;
  let y = height - 72;

  const drawText = (
    text: string,
    opts: { size?: number; font?: typeof font; color?: ReturnType<typeof rgb>; gap?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: opts.font ?? font,
      color: opts.color ?? rgb(0.1, 0.12, 0.15),
    });
    y -= opts.gap ?? size + 8;
  };

  drawText('Electronic Signature Certificate', { size: 18, font: bold, gap: 30 });
  drawText(input.documentTitle, { size: 14, font: bold, gap: 26 });
  drawText(
    'The signer below has reviewed and electronically agreed to the document named above.',
    { size: 11, gap: 26 },
  );
  if (input.documentPath) {
    drawText(`Reference document: ${input.documentPath}`, { size: 9, color: rgb(0.4, 0.42, 0.46), gap: 26 });
  }

  drawText(`Signed by: ${input.signerName}`, { size: 12, font: bold, gap: 18 });
  drawText(`Date: ${input.signedAt.toISOString()}`, { size: 10, color: rgb(0.35, 0.37, 0.4), gap: 16 });
  drawText(`IP address: ${input.ipAddress ?? 'unknown'}`, {
    size: 10,
    color: rgb(0.35, 0.37, 0.4),
    gap: 30,
  });

  // Signature block.
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 0.75,
    color: rgb(0.8, 0.82, 0.85),
  });
  y -= 20;
  drawText('Signature', { size: 9, color: rgb(0.45, 0.47, 0.5), gap: 14 });

  if (input.signatureImage) {
    try {
      const embedded =
        input.signatureImage.mime === 'image/png'
          ? await pdf.embedPng(input.signatureImage.buffer)
          : await pdf.embedJpg(input.signatureImage.buffer);
      const maxW = 220;
      const scale = Math.min(1, maxW / embedded.width);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, { x: marginX, y: y - h, width: w, height: h });
      y -= h + 10;
    } catch {
      drawText(input.signerName, { size: 20, gap: 30 });
    }
  } else {
    drawText(input.signerName, { size: 20, gap: 30 });
  }

  page.drawText(
    'This certificate is an audit record of an electronic signature captured by Stride.',
    { x: marginX, y: 48, size: 8, font, color: rgb(0.5, 0.52, 0.55) },
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function loadSignatureTask(ctx: EssTenantContext, taskId: string) {
  return ctx.run((tx) =>
    tx.onboardingTask.findFirst({
      where: {
        id: taskId,
        ...ctx.where(),
        taskType: OnboardingTaskType.SIGNATURE,
        assignedRole: 'employee',
        workflow: { employeeId: ctx.employeeId!, status: WorkflowStatus.IN_PROGRESS },
      },
      include: {
        signatureRequest: true,
        workflow: { select: { id: true, type: true, template: { select: { name: true } } } },
      },
    }),
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const task = await loadSignatureTask(ctx, taskId);
    if (!task) return NextResponse.json({ error: 'Signature task not found.' }, { status: 404 });
    if (!task.signatureRequest) {
      return NextResponse.json({ error: 'This signature task is not configured.' }, { status: 409 });
    }

    const sig = task.signatureRequest;
    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        isRequired: task.isRequired,
        dueDate: task.dueDate?.toISOString() ?? null,
        taskType: task.taskType,
      },
      workflow: {
        id: task.workflow.id,
        type: task.workflow.type,
        templateName: task.workflow.template?.name ?? null,
      },
      signature: {
        id: sig.id,
        documentTitle: sig.documentTitle,
        documentPath: sig.documentPath,
        status: sig.status,
        signerName: sig.signerName,
        signedDocumentPath: sig.signedDocumentPath,
        declineReason: sig.declineReason,
        signedAt: sig.signedAt?.toISOString() ?? null,
      },
    });
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });

    const task = await loadSignatureTask(ctx, taskId);
    if (!task || !task.signatureRequest) {
      return NextResponse.json({ error: 'Signature task not found.' }, { status: 404 });
    }
    const sig = task.signatureRequest;
    if (sig.status === OnboardingSignatureStatus.SIGNED) {
      return NextResponse.json({ error: 'This document is already signed.' }, { status: 409 });
    }
    if (sig.status === OnboardingSignatureStatus.VOIDED) {
      return NextResponse.json({ error: 'This signature request was voided by HR.' }, { status: 409 });
    }

    // --- Decline path (does not complete the task) ---
    if (body.decline === true || body.action === 'decline') {
      const declineReason = typeof body.declineReason === 'string' ? body.declineReason.trim() : '';
      if (!declineReason) {
        return NextResponse.json({ error: 'A reason is required to decline.' }, { status: 400 });
      }
      const updated = await ctx.run((tx) =>
        tx.onboardingSignatureRequest.update({
          where: { id: sig.id },
          data: { status: OnboardingSignatureStatus.DECLINED, declineReason },
        }),
      );
      await ctx.audit({
        action: 'ess.onboarding.signature.declined',
        entityType: 'OnboardingSignatureRequest',
        entityId: sig.id,
        route: 'POST /api/ess/onboarding/sign/[taskId]',
        metadata: { taskId: task.id },
      });
      return NextResponse.json({ signature: { id: updated.id, status: updated.status } });
    }

    // --- Sign path ---
    const signerName = typeof body.signerName === 'string' ? body.signerName.trim() : '';
    if (!signerName) return NextResponse.json({ error: 'Signer name is required.' }, { status: 400 });
    if (body.agree !== true) {
      return NextResponse.json({ error: 'You must agree before signing.' }, { status: 400 });
    }

    const signedAt = new Date();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0]!.trim() : request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const signatureImage =
      typeof body.signatureDataUrl === 'string' && body.signatureDataUrl.startsWith('data:')
        ? decodeDataUrl(body.signatureDataUrl)
        : null;

    let signatureImagePath: string | null = null;
    if (signatureImage) {
      const ext = signatureImage.mime === 'image/png' ? 'png' : 'jpg';
      signatureImagePath = await storeBuffer(
        signatureImage.buffer,
        `signatures/${sig.id}-${Date.now()}.${ext}`,
        signatureImage.mime,
      );
    }

    let signedDocumentPath: string | null = null;
    try {
      const pdfBuffer = await buildSignedPdf({
        documentTitle: sig.documentTitle,
        documentPath: sig.documentPath,
        signerName,
        signatureImage,
        signedAt,
        ipAddress: ipAddress ?? null,
      });
      signedDocumentPath = await storeBuffer(
        pdfBuffer,
        `signatures/${sig.id}-${Date.now()}-signed.pdf`,
        'application/pdf',
      );
    } catch (error) {
      console.error('[onboarding] Failed to generate signed PDF:', error);
      return NextResponse.json({ error: 'Could not generate the signed document.' }, { status: 500 });
    }

    const updated = await ctx.run(async (tx) => {
      const signature = await tx.onboardingSignatureRequest.update({
        where: { id: sig.id },
        data: {
          status: OnboardingSignatureStatus.SIGNED,
          signerName,
          essPortalUserId: ctx.essUser.id,
          employeeId: ctx.employeeId,
          signatureImagePath,
          signedDocumentPath,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          signedAt,
        },
      });
      await tx.onboardingTask.update({
        where: { id: task.id },
        data: { status: OnboardingTaskStatus.COMPLETED, completedAt: signedAt },
      });
      return signature;
    });

    await refreshWorkflowTaskSLAs(task.workflowId);
    await maybeCompleteWorkflow(task.workflowId);

    await ctx.audit({
      action: 'ess.onboarding.signature.signed',
      entityType: 'OnboardingSignatureRequest',
      entityId: sig.id,
      route: 'POST /api/ess/onboarding/sign/[taskId]',
      metadata: { taskId: task.id, workflowId: task.workflowId, ipAddress, essUserId: ctx.essUser.id },
    });

    try {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'onboarding_task_assigned',
        recipientUserIds: hrUserIds,
        title: 'Document signed',
        body: `${signerName} signed "${sig.documentTitle}".`,
        href: `/dashboard/onboarding/signatures/${sig.id}`,
        priority: 'info',
        channel: 'in_app',
      });
    } catch (error) {
      console.error('[onboarding] Failed to notify signature:', error);
    }

    return NextResponse.json({
      signature: {
        id: updated.id,
        status: updated.status,
        signedDocumentPath: updated.signedDocumentPath,
        signedAt: updated.signedAt?.toISOString() ?? null,
      },
    });
  });
}
