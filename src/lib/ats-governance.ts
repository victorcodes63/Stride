import type { NextRequest } from 'next/server';
import type { AtsApprovalStatus } from '@prisma/client';
import type { StaffUser } from '@/lib/staff-api-auth';
import { parseEntityIdFromRequest, jobLocationMatchesEntity } from '@/lib/entity-request';

export function canManageRequisitions(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'business_manager';
}

export function canSubmitScorecards(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'operations' || user.staffUserType === 'business_manager';
}

export function canManageOfferApprovals(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'business_manager' || user.staffUserType === 'director';
}

export function canConvertHire(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'business_manager';
}

export function canActOnApproval(user: StaffUser, approverUserId: string): boolean {
  return user.role === 'admin' || user.id === approverUserId;
}

export function parseApprovalAction(actionRaw: unknown): AtsApprovalStatus | null {
  if (actionRaw === 'approved' || actionRaw === 'rejected') return actionRaw;
  return null;
}

export function getAtsEntityJobWhere(request: NextRequest) {
  const entityId = parseEntityIdFromRequest(request);
  return entityId ? jobLocationMatchesEntity(entityId) : undefined;
}
