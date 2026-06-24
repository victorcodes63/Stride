import type { AssetCategory, AssetStatus } from '@prisma/client';

export const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'it_equipment', label: 'IT equipment' },
  { value: 'mobile_device', label: 'Mobile device' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'tools', label: 'Tools & equipment' },
  { value: 'uniform_ppe', label: 'Uniform / PPE' },
  { value: 'other', label: 'Other' },
];

export const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'maintenance', label: 'In maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'lost', label: 'Lost / missing' },
];

export function assetCategoryLabel(value: string): string {
  return ASSET_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function assetStatusLabel(value: string): string {
  return ASSET_STATUSES.find((s) => s.value === value)?.label ?? value;
}
