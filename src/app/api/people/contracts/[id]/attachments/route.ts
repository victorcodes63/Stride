import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';

const ALLOWED_TYPES = ['application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function contractUploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads', 'contracts');
}

async function ensureContractAccess(contractId: string, request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const billing = await getOrCreatePrimaryAccountsClient(prisma, request);
  const contract = await prisma.accountsContract.findFirst({
    where: { id: contractId, clientId: billing.id },
    select: { id: true },
  });
  if (!contract) return { user, error: NextResponse.json({ error: 'Contract not found' }, { status: 404 }) };
  return { user, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await ensureContractAccess(id, request);
  if (access.error) return access.error;

  const dir = contractUploadsDir();
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  const contractPrefix = `${id}__`;
  const matches = entries.filter((name) => name.startsWith(contractPrefix));

  const files = await Promise.all(
    matches.map(async (name) => {
      const filePath = path.join(dir, name);
      const st = await stat(filePath);
      const parts = name.split('__');
      const originalName = parts.length >= 3 ? parts.slice(2).join('__') : name;
      return {
        name,
        originalName,
        size: st.size,
        uploadedAt: st.mtime.toISOString(),
        url: `/uploads/contracts/${encodeURIComponent(name)}`,
      };
    }),
  );

  files.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  return NextResponse.json(files);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await ensureContractAccess(id, request);
  if (access.error) return access.error;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB).' }, { status: 400 });
  }

  const dir = contractUploadsDir();
  await mkdir(dir, { recursive: true });
  const timestamp = Date.now();
  const safe = cleanFileName(file.name || 'contract.pdf');
  const fileName = `${id}__${timestamp}__${safe.endsWith('.pdf') ? safe : `${safe}.pdf`}`;
  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({
    name: fileName,
    originalName: safe,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/contracts/${encodeURIComponent(fileName)}`,
  });
}

