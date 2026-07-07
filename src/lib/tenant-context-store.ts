/** Active organizationId for the current withOrgContext transaction (dev/staging guards). */
let activeOrganizationId: string | null = null;

export function setActiveOrganizationId(organizationId: string | null): void {
  activeOrganizationId = organizationId;
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId;
}
