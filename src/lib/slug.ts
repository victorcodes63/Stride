/**
 * URL-safe slug generation for job apply URLs.
 * Used for /careers/apply/[slug] (e.g. senior-accountant-nairobi).
 */

/**
 * Converts a string to a URL-safe slug: lowercase, hyphens, no leading/trailing hyphens.
 * Collapses multiple spaces/hyphens into one.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'job';
}

/**
 * Builds a base slug from job title and location (e.g. "Senior Accountant" + "Nairobi" -> "senior-accountant-nairobi").
 * Optionally appends a short id suffix for uniqueness.
 */
export function jobSlugBase(title: string, location: string, idSuffix?: string): string {
  const fromTitle = slugify(title);
  const fromLocation = slugify(location);
  const parts = [fromTitle, fromLocation].filter(Boolean);
  const base = parts.length ? parts.join('-') : 'job';
  if (idSuffix) {
    const suffix = idSuffix.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    return suffix ? `${base}-${suffix}` : base;
  }
  return base;
}

/**
 * Base slug for insight/article URLs (e.g. "Pay transparency" -> "pay-transparency").
 */
export function insightSlugBase(title: string, idSuffix?: string): string {
  const base = slugify(title) || 'insight';
  if (idSuffix) {
    const suffix = idSuffix.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    return suffix ? `${base}-${suffix}` : base;
  }
  return base;
}

/**
 * Returns a slug that is unique according to the provided existence check.
 * If the base slug is taken, appends -2, -3, ... until an available one is found.
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const candidate = baseSlug.replace(/^-+|-+$/g, '') || 'job';
  let slug = candidate;
  let n = 2;
  while (await exists(slug)) {
    slug = `${candidate}-${n}`;
    n += 1;
  }
  return slug;
}
