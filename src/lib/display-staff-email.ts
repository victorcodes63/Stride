/**
 * Strip demo-style segments from staff emails for UI display (sales / trust).
 * Does not change stored credentials — use patch-professional-emails.js for DB updates.
 */
export function displayStaffEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;

  const local = email.slice(0, at);
  const domain = email
    .slice(at + 1)
    .replace(/\.demo(?=\.|$)/gi, '')
    .replace(/^demo\./i, '');

  let cleanLocal = local;
  if (/^demo$/i.test(cleanLocal)) {
    cleanLocal = 'admin';
  } else if (/\.demo$/i.test(cleanLocal)) {
    cleanLocal = cleanLocal.replace(/\.demo$/i, '');
  }

  return `${cleanLocal}@${domain}`;
}

/** Hide sandbox-style addresses in customer-facing UI. */
export function isSandboxEmail(email: string): boolean {
  return /demo/i.test(email);
}
