#!/usr/bin/env node
/**
 * RAV-62: Add Organization + organizationId to every tenant table in schema.prisma.
 * Global tables (no organizationId): User, PermissionDefinition, RolePermission, SchedulerLock.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../prisma/schema.prisma');

const GLOBAL_MODELS = new Set([
  'Organization',
  'OrganizationMembership',
  'User',
  'PermissionDefinition',
  'RolePermission',
  'SchedulerLock',
]);

const ORG_MODELS = `

// --- Multi-tenant core (Phase 0 / RAV-62) ---

/// Tenant boundary — one client company per row. RLS isolates by organizationId.
model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  country   String   @default("KE")
  currency  String   @default("KES")
  timezone  String   @default("Africa/Nairobi")
  settings  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships OrganizationMembership[]
}

/// Links global User to Organization with per-org role (session scoping in RAV-63).
model OrganizationMembership {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String
  organizationId String   @db.Uuid
  role           UserRole @default(staff)
  status         String   @default("active")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
}
`;

const ORG_FIELD = `  organizationId String @db.Uuid

`;

let schema = readFileSync(schemaPath, 'utf8');

if (schema.includes('model Organization {')) {
  console.log('Organization model already present — skipping patch.');
  process.exit(0);
}

// Insert Organization models after UserRole enum block.
const userRoleAnchor = `enum UserRole {
  admin
  staff
  viewer
}`;
if (!schema.includes(userRoleAnchor)) {
  throw new Error('Could not find UserRole enum anchor in schema.prisma');
}
schema = schema.replace(userRoleAnchor, `${userRoleAnchor}\n${ORG_MODELS}`);

// Add memberships relation to User model.
schema = schema.replace(
  /(model User \{[\s\S]*?)(  @@index\(\[email\]\))/,
  `$1  organizationMemberships OrganizationMembership[]\n\n$2`,
);

const modelRegex = /^model (\w+) \{/gm;
const models = [...schema.matchAll(modelRegex)].map((m) => m[1]);

for (const model of models) {
  if (GLOBAL_MODELS.has(model)) continue;

  const modelBlockRegex = new RegExp(`(model ${model} \\{[^]*?)(\\n\\})`, 'm');
  const match = schema.match(modelBlockRegex);
  if (!match) {
    console.warn(`Could not patch model ${model}`);
    continue;
  }
  if (match[0].includes('organizationId')) {
    console.log(`  skip ${model} (already has organizationId)`);
    continue;
  }

  // Insert after the id line (first field block).
  const patched = match[1].replace(
    /(@id[^\n]*\n)/,
    `$1${ORG_FIELD}\n`,
  );
  schema = schema.replace(modelBlockRegex, `${patched}\n}`);
  console.log(`  patched ${model}`);
}

writeFileSync(schemaPath, schema);
console.log(`Patched ${models.length - GLOBAL_MODELS.size} tenant models in ${schemaPath}`);
