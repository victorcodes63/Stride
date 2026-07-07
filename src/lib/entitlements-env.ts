function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Edge/middleware-safe — env check only, no DB or control-plane fetch. */
export function isControlPlaneSyncConfigured(): boolean {
  return Boolean(trimEnv('CONTROL_PLANE_URL') && trimEnv('CONTROL_PLANE_CUSTOMER_SLUG'));
}

export function getControlPlaneCustomerSlug(): string | undefined {
  return trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
}

export function getControlPlaneUrl(): string | undefined {
  return trimEnv('CONTROL_PLANE_URL');
}
