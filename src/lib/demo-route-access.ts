import { NextResponse } from 'next/server';
import type { StaffUser } from '@/lib/staff-api-auth';

export function canAccessPayroll(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'finance';
}

export function canAccessFleet(user: StaffUser): boolean {
  return (
    user.role === 'admin' ||
    user.staffUserType === 'business_manager' ||
    user.staffUserType === 'operations'
  );
}

export function canAccessAssets(user: StaffUser): boolean {
  return (
    user.role === 'admin' ||
    user.staffUserType === 'business_manager' ||
    user.staffUserType === 'operations'
  );
}

export function canAccessCredentials(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'business_manager';
}

export function canAccessEmployeeDocuments(user: StaffUser): boolean {
  return user.role === 'admin' || user.staffUserType === 'business_manager';
}

export function canDeleteEmployeeDocuments(user: StaffUser): boolean {
  return user.role === 'admin';
}

export function canViewSalaryFields(user: StaffUser): boolean {
  return canAccessPayroll(user);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenResponse(message = 'Insufficient permissions') {
  return NextResponse.json({ error: message }, { status: 403 });
}
