#!/usr/bin/env node
/**
 * RAV-132 — Integration reality check (gated vs wired).
 */
const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_LOGIN_EMAIL || 'admin@demo.getstride.co.ke';
const PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!';

const results = [];
const notes = [];

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function check(label, fn) {
  try {
    await fn();
    results.push({ label, ok: true });
    console.log(`✓ ${label}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ label, ok: false, message });
    console.log(`✗ ${label}: ${message}`);
  }
}

function note(integration, status) {
  notes.push({ integration, status });
  console.log(`  ℹ ${integration}: ${status}`);
}

async function main() {
  console.log(`\nRAV-132 integrations check → ${BASE}\n`);

  let cookie = '';
  await check('staff login', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!res.ok) throw new Error(await res.text());
    cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
    if (!cookie) throw new Error('no cookie');
  });

  const auth = { Cookie: cookie };

  await check('GET /api/config/deployment', async () => {
    const res = await fetch(`${BASE}/api/config/deployment`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    note('deployment config', JSON.stringify({
      demoMode: body.demoMode,
      oauthEnabled: body.oauthEnabled,
      modules: body.modules,
    }));
  });

  await check('OAuth start routes respond (not 500)', async () => {
    for (const path of ['/api/auth/google/start', '/api/auth/microsoft/start']) {
      const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
      if (res.status >= 500) throw new Error(`${path} → ${res.status}`);
      note(path, res.status === 302 || res.status === 200 ? 'reachable' : `status ${res.status} (likely disabled — OK)`);
    }
  });

  await check('ESS OAuth start routes respond (not 500)', async () => {
    for (const path of ['/api/ess/auth/google/start', '/api/ess/auth/microsoft/start']) {
      const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
      if (res.status >= 500) throw new Error(`${path} → ${res.status}`);
    }
  });

  await check('GET /api/outsourcing/payroll/disbursements (M-Pesa sandbox path)', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/payroll/disbursements?month=3&year=2026`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    note('M-Pesa disbursements', 'API loads; provider is simulated unless MPESA_PROVIDER=daraja');
  });

  await check('cron biometric route exists (auth-gated)', async () => {
    const res = await fetch(`${BASE}/api/cron/biometric-poll`, { method: 'POST' });
    // Expect 401 without CRON_SECRET — proves route exists, not open
    if (res.status === 404) throw new Error('route missing');
    if (res.status >= 500) throw new Error(`status ${res.status}`);
    note('biometric poll cron', res.status === 401 || res.status === 403 ? 'gated (expected)' : `status ${res.status}`);
  });

  note(
    'SMTP email',
    process.env.SMTP_HOST || process.env.RESEND_API_KEY
      ? 'env configured (send not exercised in CI)'
      : 'not configured in .env.local — book-demo/contact may queue or noop; OK for local demo',
  );

  note(
    'Vercel Blob uploads',
    process.env.BLOB_READ_WRITE_TOKEN
      ? 'token present'
      : 'no BLOB_READ_WRITE_TOKEN — company-documents upload may fail gracefully in dev',
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
