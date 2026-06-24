import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseEssSession } from '@/lib/ess-session';

const COOKIE = 'ess_session';

export type EssUser = {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr';
  mustResetPassword: boolean;
};

export async function requireEssUser(request: NextRequest): Promise<EssUser | null> {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw || !process.env.DATABASE_URL) return null;
  const parsed = parseEssSession(raw);
  if (!parsed.userId) return null;

  const user = await prisma.essPortalUser.findUnique({
    where: { id: parsed.userId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
    },
  });

  if (!user?.isActive) return null;

  return {
    id: user.id,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    mustResetPassword: user.mustResetPassword,
  };
}
