#!/usr/bin/env node
/**
 * Validate environment before provisioning or deploying a client instance.
 *
 * Usage:
 *   node scripts/provision-check.mjs              # production profile (default)
 *   node scripts/provision-check.mjs --profile demo
 *   node scripts/provision-check.mjs --env-file .env.local
 */

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const args = process.argv.slice(2);

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const profile = argValue('--profile') ?? 'production';
const envFile = argValue('--env-file') ?? '.env.local';
const envPath = path.join(projectRoot, envFile);

const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'STAFF_ALLOWED_DOMAIN',
  'STAFF_PASSWORD',
  'PROVISION_ADMIN_EMAIL',
  'NEXT_PUBLIC_ORG_NAME',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_SITE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
];

const DEMO_EXTRA = ['DEMO_MODE', 'NEXT_PUBLIC_DEMO_MODE'];

const PRODUCTION_FORBIDDEN_WHEN_TRUE = ['DEMO_MODE', 'NEXT_PUBLIC_DEMO_MODE'];

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function get(key, parsed) {
  return parsed.get(key) || process.env[key] || '';
}

function parseBool(v) {
  if (!v) return false;
  const n = v.trim().toLowerCase();
  return n === '1' || n === 'true' || n === 'yes' || n === 'on';
}

function warn(msg) {
  console.warn(`⚠ ${msg}`);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
}

if (!fs.existsSync(envPath)) {
  fail(`Missing env file: ${envFile}`);
  console.error('Copy .env.example to .env.local and configure for this client deployment.');
  process.exit(1);
}

const parsed = parseEnv(fs.readFileSync(envPath, 'utf8'));
let exitCode = 0;

console.log(`\nProvision check — profile: ${profile}, env: ${envFile}\n`);

const required =
  profile === 'demo'
    ? [...PRODUCTION_REQUIRED.filter((k) => k !== 'PROVISION_ADMIN_EMAIL'), 'STAFF_PASSWORD']
    : PRODUCTION_REQUIRED;

const missing = required.filter((key) => !get(key, parsed));
if (missing.length) {
  for (const key of missing) fail(`Missing required: ${key}`);
  exitCode = 1;
} else {
  ok(`Required variables present (${required.length})`);
}

if (profile === 'production') {
  for (const key of PRODUCTION_FORBIDDEN_WHEN_TRUE) {
    if (parseBool(get(key, parsed))) {
      fail(`${key}=true is not allowed on production client deployments`);
      exitCode = 1;
    }
  }
}

if (profile === 'demo') {
  const demoOn = DEMO_EXTRA.some((key) => parseBool(get(key, parsed)));
  if (!demoOn) warn(`Demo profile but ${DEMO_EXTRA.join(' / ')} not enabled — login hints will be hidden`);
}

const adminEmail = get('PROVISION_ADMIN_EMAIL', parsed);
const allowedDomains = get('STAFF_ALLOWED_DOMAIN', parsed)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
if (adminEmail && allowedDomains.length) {
  const domain = adminEmail.split('@')[1]?.toLowerCase();
  if (domain && !allowedDomains.includes(domain)) {
    fail(`PROVISION_ADMIN_EMAIL domain (@${domain}) not in STAFF_ALLOWED_DOMAIN`);
    exitCode = 1;
  } else if (domain) {
    ok(`Admin email domain allowed (@${domain})`);
  }
}

const moduleKeys = [
  'MODULE_LEAVE',
  'MODULE_TIME',
  'MODULE_PAYROLL',
  'MODULE_ATS',
  'MODULE_PERFORMANCE',
  'MODULE_HSE',
  'MODULE_ACCOUNTS',
  'MODULE_DISCIPLINARY',
  'MODULE_REPORTS',
  'MODULE_ESS',
];
const disabledModules = moduleKeys.filter((key) => get(key, parsed).toLowerCase() === 'false');
if (disabledModules.length) {
  ok(`Licensed modules disabled: ${disabledModules.join(', ')}`);
} else {
  ok('All optional modules enabled (default full suite)');
}

if (!get('BLOB_READ_WRITE_TOKEN', parsed) && profile === 'production') {
  warn('BLOB_READ_WRITE_TOKEN unset — document/resume uploads will fail in production');
}

if (!get('CRON_SECRET', parsed) && profile === 'production') {
  warn('CRON_SECRET unset — scheduled reminder crons will not authenticate');
}

if (!get('DIRECT_DATABASE_URL', parsed) && get('DATABASE_URL', parsed).includes('-pooler')) {
  warn('DATABASE_URL uses pooler host — set DIRECT_DATABASE_URL for migrate deploy on Vercel builds');
}

const multiEntity = parseBool(get('MULTI_ENTITY_ENABLED', parsed));
const defaultCountry = (get('DEFAULT_COUNTRY', parsed) || 'KE').toUpperCase();
if (multiEntity) {
  ok('MULTI_ENTITY_ENABLED=true — multi-entity capability licensed');
  if (defaultCountry !== 'KE' && defaultCountry !== 'UG') {
    warn(`DEFAULT_COUNTRY=${defaultCountry} — v1 multi-entity supports KE and UG statutory packs only`);
  }
} else {
  ok(`Single-entity mode (MULTI_ENTITY_ENABLED=false) — default country ${defaultCountry || 'KE'}`);
}

if (multiEntity && profile === 'production') {
  ok('Configure operating entities in Dashboard → Admin → Company setup after first deploy');
}

console.log('');
if (exitCode === 0) {
  console.log('Provision check passed.\n');
} else {
  console.error('Provision check failed.\n');
}
process.exit(exitCode);
