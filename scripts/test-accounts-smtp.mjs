#!/usr/bin/env node
/**
 * Test Accounts SMTP connection from terminal.
 * Run: npm run test:accounts-smtp
 * Or:  node --env-file=.env scripts/test-accounts-smtp.mjs
 *
 * Use this to verify ACCOUNTS_SMTP_USER and ACCOUNTS_SMTP_PASS before sending payslips.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import nodemailer from 'nodemailer';

// Load .env (Node 20.6+ has --env-file; fallback: manual load)
function loadEnv() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}
loadEnv();

const user = process.env.ACCOUNTS_SMTP_USER?.trim();
const pass = process.env.ACCOUNTS_SMTP_PASS;
const host = process.env.ACCOUNTS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.office365.com';
const port = parseInt(process.env.ACCOUNTS_SMTP_PORT || process.env.SMTP_PORT || '587', 10);

console.log('\n--- Accounts SMTP Test ---');
console.log('host:', host);
console.log('port:', port);
console.log('user:', user || '(not set)');
console.log('hasPass:', !!pass);
console.log('passLength:', pass ? pass.length : 0);
console.log('');

if (!user || !pass) {
  console.error('ERROR: Set ACCOUNTS_SMTP_USER and ACCOUNTS_SMTP_PASS in .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  console.log('Verifying SMTP connection...');
  await transporter.verify();
  console.log('OK: Connection successful. Credentials are valid.\n');
  process.exit(0);
} catch (err) {
  console.error('FAILED:', err.message);
  if (err.response) console.error('SMTP response:', err.response);
  if (err.responseCode) console.error('Response code:', err.responseCode);
  console.error('\nCommon fixes:');
  console.error('  - Use an app password if MFA is enabled on the account');
  console.error('  - Enable "Authenticated SMTP" for the mailbox in Microsoft 365 Admin');
  console.error('  - Ensure ACCOUNTS_SMTP_PASS has no extra spaces or quotes\n');
  process.exit(1);
}
