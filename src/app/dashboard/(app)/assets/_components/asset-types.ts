export type AssetRecord = {
  id: string;
  assetTag: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyExpiry: string | null;
  location: string | null;
  notes: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedEmployeeNumber: string | null;
  assignedEmployeeJobTitle: string | null;
  assignedEmployeeDepartment: string | null;
  assignedAt: string | null;
  assignedByUserName: string | null;
  handoverAcknowledgedAt: string | null;
  handoverNotes: string | null;
  handoverSignaturePath: string | null;
  needsHandoverAck: boolean;
  depreciationMethod: string;
  usefulLifeMonths: number | null;
  salvageValue: number | null;
  bookValue: number | null;
  accumulatedDepreciation: number | null;
  monthlyDepreciation: number | null;
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string | null;
  maintenanceCount: number;
  qrToken: string | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AssetListResponse = {
  items: AssetRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type AssetSummary = {
  total: number;
  assigned: number;
  available: number;
  maintenance: number;
  retired: number;
  lost: number;
  warrantyExpiring: number;
  handoverPending: number;
  maintenanceDue: number;
};

export type AssetHistoryEvent = {
  id: string;
  eventType: string;
  employeeLabel: string | null;
  fromEmployeeLabel: string | null;
  performedByUserName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  createdAt: string;
};

export type AssetMaintenanceRecord = {
  id: string;
  companyAssetId: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  vendor: string | null;
  cost: number | null;
  scheduledFor: string | null;
  completedAt: string | null;
  nextDueAt: string | null;
  performedByUserName: string | null;
  createdByUserName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetAttachmentRecord = {
  id: string;
  companyAssetId: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  kind: string | null;
  createdAt: string;
};

export type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
};

export function assetStatusChipTone(status: string) {
  switch (status) {
    case 'available':
      return 'success' as const;
    case 'assigned':
      return 'info' as const;
    case 'maintenance':
      return 'primary' as const;
    case 'retired':
      return 'neutral' as const;
    case 'lost':
      return 'danger' as const;
    default:
      return 'neutral' as const;
  }
}

export function maintenanceStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'in_progress':
      return 'info' as const;
    case 'scheduled':
      return 'primary' as const;
    case 'cancelled':
      return 'neutral' as const;
    default:
      return 'neutral' as const;
  }
}

export function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
