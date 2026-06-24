/** Marks demo-only rows scoped to an operating entity (multi-vertical switcher). */
export const DEMO_ENTITY_NOTE_PREFIX = 'DEMO_ENTITY:';

export function demoEntityNote(entityCode: string): string {
  return `${DEMO_ENTITY_NOTE_PREFIX}${entityCode}`;
}

export function parseDemoEntityNote(notes: string | null | undefined): string | null {
  if (!notes?.startsWith(DEMO_ENTITY_NOTE_PREFIX)) return null;
  const code = notes.slice(DEMO_ENTITY_NOTE_PREFIX.length).trim();
  return code.length > 0 ? code : null;
}

export function demoEntityDocumentTags(entityCode: string): { entityCode: string } {
  return { entityCode };
}

export function demoEntityAnnouncementRoles(entityCode: string): { demoEntityCode: string } {
  return { demoEntityCode: entityCode };
}
