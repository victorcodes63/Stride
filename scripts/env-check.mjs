import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const envLocalPath = path.join(projectRoot, '.env.local');

const REQUIRED = ['DATABASE_URL', 'STAFF_ALLOWED_DOMAIN', 'SMTP_HOST', 'SMTP_PORT'];

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

if (!fs.existsSync(envLocalPath)) {
  console.error('Missing .env.local file.');
  process.exit(1);
}

const parsed = parseEnv(fs.readFileSync(envLocalPath, 'utf8'));
const missing = REQUIRED.filter((key) => !(parsed.get(key) || process.env[key]));

if (missing.length > 0) {
  console.error('Missing required env vars:');
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log('Environment check passed.');
console.log(`Checked required vars: ${REQUIRED.join(', ')}`);

