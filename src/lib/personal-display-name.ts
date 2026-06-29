/** Derive a person-friendly display name — never prefer company legal names for greetings. */

const ORG_NAME_PATTERN =
  /\b(group|ltd|limited|incorporated|inc\.?|corp\.?|corporation|company|co\.?|plc|llc|sacco|holdings|enterprises|east africa|tech)\b/i;

export function looksLikeOrganizationName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return ORG_NAME_PATTERN.test(trimmed);
}

/** First segment of email local part, title-cased (vchumo → Vchumo, victor.chumo → Victor). */
export function nameFromEmailLocalPart(email: string): string | null {
  const local = email.trim().toLowerCase().split("@")[0];
  if (!local) return null;
  const segment = local.split(/[.+_-]/)[0]?.trim();
  if (!segment || segment.length < 2) return null;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function resolvePersonalDisplayName(input: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = input.name?.trim() ?? "";
  if (name && !looksLikeOrganizationName(name)) return name;

  const fromEmail = input.email ? nameFromEmailLocalPart(input.email) : null;
  if (fromEmail) return fromEmail;

  if (name) {
    const first = name.split(/\s+/).filter(Boolean)[0];
    if (first && !looksLikeOrganizationName(first)) return first;
  }

  return "there";
}
