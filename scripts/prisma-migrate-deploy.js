const { spawnSync } = require('child_process');

/**
 * When to run `prisma migrate deploy` during `npm run build`:
 * - Always on Vercel Production builds (VERCEL_ENV=production), unless opted out
 * - Or when RUN_MIGRATIONS_ON_BUILD is true / 1
 * - Skip when RUN_MIGRATIONS_ON_BUILD=false
 *
 * Uses DIRECT_DATABASE_URL (Neon non-pooler) via schema.prisma directUrl for advisory locks.
 */
function shouldRunMigrations() {
  const raw = (process.env.RUN_MIGRATIONS_ON_BUILD || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') {
    return { run: false, reason: 'RUN_MIGRATIONS_ON_BUILD disables migrations.' };
  }
  if (raw === 'true' || raw === '1' || raw === 'yes') {
    return { run: true, reason: 'RUN_MIGRATIONS_ON_BUILD enabled.' };
  }
  if (process.env.VERCEL_ENV === 'production') {
    return { run: true, reason: 'Vercel Production build (VERCEL_ENV=production).' };
  }
  return {
    run: false,
    reason:
      'Not Vercel Production and RUN_MIGRATIONS_ON_BUILD not set. ' +
      'Set RUN_MIGRATIONS_ON_BUILD=true for CI, or deploy to Vercel Production.',
  };
}

function sleepMs(ms) {
  spawnSync('sleep', [String(Math.ceil(ms / 1000))], { stdio: 'ignore' });
}

function resolveDirectDatabaseUrl() {
  const direct =
    process.env.DIRECT_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';
  if (direct.trim()) return direct.trim();

  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (dbUrl.includes('-pooler.')) {
    return dbUrl.replace('-pooler.', '.');
  }
  return dbUrl;
}

function runPrisma(args, migrateEnv) {
  return spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: migrateEnv,
  });
}

function runMigrateAttempt(migrateEnv) {
  return runPrisma(['migrate', 'deploy'], migrateEnv);
}

/** Avoid advisory-lock contention when schema is already current (common on Vercel rebuilds). */
function isDatabaseUpToDate(migrateEnv) {
  const result = runPrisma(['migrate', 'status'], migrateEnv);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  if (result.status !== 0) {
    console.warn('[prisma-migrate-deploy] migrate status failed — will attempt deploy.');
    if (output.trim()) process.stderr.write(output);
    return false;
  }

  if (output.includes('Database schema is up to date')) {
    return true;
  }

  if (output.includes('have not yet been applied')) {
    return false;
  }

  // Unknown output — run deploy to be safe.
  return false;
}

function run() {
  const { run: doMigrate, reason } = shouldRunMigrations();

  if (!doMigrate) {
    console.log(`[prisma-migrate-deploy] Skipping prisma migrate deploy — ${reason}`);
    return;
  }

  console.log(`[prisma-migrate-deploy] Running prisma migrate deploy (${reason})`);

  if (!process.env.DATABASE_URL) {
    console.error('[prisma-migrate-deploy] DATABASE_URL is missing — cannot migrate.');
    process.exit(1);
  }

  const direct = resolveDirectDatabaseUrl();
  if (!direct) {
    console.error(
      '[prisma-migrate-deploy] DIRECT_DATABASE_URL (or Neon DATABASE_URL_UNPOOLED) is missing — cannot migrate safely.',
    );
    process.exit(1);
  }

  const migrateEnv = {
    ...process.env,
    DIRECT_DATABASE_URL: direct,
    PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT:
      process.env.PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT || '120000',
  };

  console.log('[prisma-migrate-deploy] Using direct (non-pooler) URL via DIRECT_DATABASE_URL / directUrl.');

  if (isDatabaseUpToDate(migrateEnv)) {
    console.log('[prisma-migrate-deploy] Database schema is up to date — skipping migrate deploy.');
    return;
  }

  console.log('[prisma-migrate-deploy] Pending migrations detected — running migrate deploy…');

  const maxAttempts = Number(process.env.MIGRATE_DEPLOY_RETRIES || 3);
  let lastOutput = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      console.warn(`[prisma-migrate-deploy] Retry ${attempt}/${maxAttempts} after advisory lock timeout…`);
      sleepMs(15000);
    }

    const result = runMigrateAttempt(migrateEnv);
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    lastOutput = `${stdout}\n${stderr}`.trim();

    if (result.status === 0) {
      process.stdout.write(stdout);
      return;
    }

    if (lastOutput.includes('P3009')) {
      process.stdout.write(stdout);
      process.stderr.write(stderr);
      console.warn(
        '\n[prisma-migrate-deploy] Detected P3009 (failed migration present). ' +
          'Continuing so Vercel can complete `next build`.',
      );
      return;
    }

    const lockTimeout = lastOutput.includes('P1002') || lastOutput.includes('advisory lock');
    if (lockTimeout && attempt < maxAttempts) {
      process.stderr.write(stderr);
      continue;
    }

    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exit(result.status ?? 1);
  }

  console.error(lastOutput);
  process.exit(1);
}

run();
