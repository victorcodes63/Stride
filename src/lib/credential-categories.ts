/** Shared credential category slugs — keep in sync with Prisma `CredentialCategory` enum. */
export const CREDENTIAL_CATEGORIES = [
  { value: 'medical_license', label: 'Medical license' },
  { value: 'specialist_certification', label: 'Specialist certification' },
  { value: 'life_support', label: 'Life support' },
  { value: 'regulatory_compliance', label: 'Regulatory compliance' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
  { value: 'oil_gas_safety', label: 'Oil & gas — safety / survival (OPITO, H2S, HUET)' },
  { value: 'oil_gas_well_control', label: 'Oil & gas — well control (IWCF / IADC)' },
  { value: 'oil_gas_operations', label: 'Oil & gas — operations (PTW, rigging, CompEx)' },
] as const;

export type CredentialCategorySlug = (typeof CREDENTIAL_CATEGORIES)[number]['value'];

export const CREDENTIAL_CATEGORY_SLUGS = new Set<string>(CREDENTIAL_CATEGORIES.map((c) => c.value));

export function credentialCategoryLabel(slug: string): string {
  const row = CREDENTIAL_CATEGORIES.find((c) => c.value === slug);
  return row?.label ?? slug.replaceAll('_', ' ');
}
