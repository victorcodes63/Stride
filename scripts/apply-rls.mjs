#!/usr/bin/env node
/**
 * RAV-62: Apply generated RLS policies to the database.
 * Usage: npm run db:rls  (loads .env.local via package.json)
 *
 * Uses DIRECT_DATABASE_URL when set (owner role required for ALTER TABLE).
 * Skips statements for tables not yet migrated (42P01).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, '../prisma/migrations/rls_policies.sql');

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(';') ? s : `${s};`));
}

async function main() {
  const connectionString =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL is required');
  }

  const sql = readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);
  const pool = new Pool({ connectionString });

  let applied = 0;
  let skipped = 0;

  try {
    for (const statement of statements) {
      try {
        await pool.query(statement);
        applied += 1;
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
        if (code === '42P01') {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }
    console.log(`RLS policies applied: ${applied} statements (${skipped} skipped — table not migrated yet).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
