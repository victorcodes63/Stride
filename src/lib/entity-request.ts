import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import type { EntityId } from '@/lib/entityConfig';
import { parseDemoEntitySlug } from '@/lib/demo-entity-slug';
import {
  getActiveEntities,
  loadOperatingEntitiesSettings,
  resolveEntitySlugOrDefault,
  slugToCountryCode,
  validateEntitySlug,
} from '@/lib/operating-entities';
import { ENTITY_HEADER, ENTITY_IDS, HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';

export { ENTITY_HEADER, HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';

/** Read raw entity slug from header, query, or cookie (not validated against config). */
export function parseEntitySlugFromRequest(
  request: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'>,
): string | null {
  const header = request.headers.get(ENTITY_HEADER)?.trim().toLowerCase();
  if (header) return header;

  const fromQuery = request.nextUrl.searchParams.get('entityId')?.trim().toLowerCase();
  if (fromQuery) return fromQuery;

  const cookie = request.cookies.get(HRIS_ENTITY_COOKIE)?.value?.trim().toLowerCase();
  if (cookie) return cookie;

  return null;
}

/** @deprecated Prefer parseEntitySlugFromRequest + async resolveEntityIdOrDefault */
export function parseEntityIdFromRequest(
  request: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'>,
): EntityId | null {
  const slug = parseEntitySlugFromRequest(request);
  if (slug === 'ke' || slug === 'ug') return slug;
  return null;
}

export function isKnownEntityId(value: string | null | undefined): value is EntityId {
  return value === 'ke' || value === 'ug';
}

/** Map entity slug to statutory country profile key (ke | ug). Supports composite demo slugs (`generic__ke`). */
export function entitySlugToStatutoryId(slug: string): EntityId {
  return parseDemoEntitySlug(slug).statutoryId;
}

/**
 * Validate entity slug from request against configured entities; fall back to defaultEntityId.
 */
export async function resolveEntityIdOrDefault(
  request: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'>,
): Promise<string> {
  const settings = await loadOperatingEntitiesSettings();
  const raw = parseEntitySlugFromRequest(request);
  return resolveEntitySlugOrDefault(raw, settings);
}

/** Safe `where` filter for rows linked to OutsourcingClient.entityCode */
export function entityScopedClientWhere(entityId: string): Prisma.OutsourcingClientWhereInput {
  return { entityCode: entityId };
}

/** Shared list filter helper for entity-bound employee/workforce queries. */
export function entityScopedEmployeeWhere(entityId: string): Prisma.EmployeeWhereInput {
  return { client: { entityCode: entityId } };
}

/** Restrict entity values used by aggregate endpoints (`all` is explicitly allowed). */
export async function parseEntityScope(scope: string | null | undefined): Promise<string | 'all'> {
  const value = (scope ?? '').trim().toLowerCase();
  if (value === 'all') return 'all';
  const settings = await loadOperatingEntitiesSettings();
  if (validateEntitySlug(value, settings)) return value;
  return 'all';
}

export async function allEntityIds(): Promise<string[]> {
  const settings = await loadOperatingEntitiesSettings();
  return getActiveEntities(settings).map((e) => e.id);
}

/** Narrow recruitment search / analytics to jobs in the active country (demo heuristic). */
export function jobLocationMatchesEntity(entityId: string): Prisma.JobWhereInput {
  const statutoryId = entitySlugToStatutoryId(entityId);
  if (statutoryId === 'ke') {
    return {
      OR: [
        { location: { contains: 'Kenya', mode: 'insensitive' } },
        { location: { contains: 'Nairobi', mode: 'insensitive' } },
        { location: { contains: 'Mombasa', mode: 'insensitive' } },
        { location: { contains: 'Nakuru', mode: 'insensitive' } },
        { location: { contains: 'Kisumu', mode: 'insensitive' } },
        { location: { contains: 'Westlands', mode: 'insensitive' } },
      ],
    };
  }
  return {
    OR: [
      { location: { contains: 'Uganda', mode: 'insensitive' } },
      { location: { contains: 'Kampala', mode: 'insensitive' } },
      { location: { contains: 'Jinja', mode: 'insensitive' } },
      { location: { contains: 'Entebbe', mode: 'insensitive' } },
      { location: { contains: 'Nansana', mode: 'insensitive' } },
    ],
  };
}

/** Static v1 entity ids for backward-compatible tests and statutory packs. */
export function legacyEntityIds(): readonly EntityId[] {
  return ENTITY_IDS;
}
