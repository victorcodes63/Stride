#!/usr/bin/env node
/**
 * RAV-128 — Demo happy-path API walk (login → core flows).
 * Logs pass/fail per step; exit 1 if any critical step fails.
 */
const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_LOGIN_EMAIL || 'admin@demo.getstride.co.ke';
const PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!';

const results = [];

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

async function main() {
  console.log(`\nRAV-128 happy-path → ${BASE}\n`);
  let cookie = '';

  await check('POST /api/auth/login', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('no session cookie');
    cookie = setCookie.split(';')[0];
  });

  const auth = { Cookie: cookie };

  await check('GET /api/dashboard/bootstrap', async () => {
    const res = await fetch(`${BASE}/api/dashboard/bootstrap`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/dashboard/overview', async () => {
    const res = await fetch(`${BASE}/api/dashboard/overview?metricsOnly=1`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/outsourcing/employees (~40 staff)', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/employees`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    const count = Array.isArray(body) ? body.length : body?.employees?.length;
    if (!count || count < 10) throw new Error(`expected ~40 employees, got ${count ?? 0}`);
  });

  await check('GET /api/outsourcing/payroll', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/payroll`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/outsourcing/payroll/run/overview', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/payroll/run/overview?month=3&year=2026`, {
      headers: auth,
    });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/outsourcing/leave/overview', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/leave/overview`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/outsourcing/payroll/disbursements', async () => {
    const res = await fetch(`${BASE}/api/outsourcing/payroll/disbursements?month=3&year=2026`, {
      headers: auth,
    });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/performance/cycles (if module on)', async () => {
    const res = await fetch(`${BASE}/api/performance/cycles`, { headers: auth });
    if (res.status === 403 || res.status === 404) {
      console.log('  (skipped — performance module gated)');
      return;
    }
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/accounts/invoices', async () => {
    const res = await fetch(`${BASE}/api/accounts/invoices`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  // ESS login
  let essCookie = '';
  const essEmail = process.env.SMOKE_ESS_EMAIL || 'employee@heritage.demo.getstride.co.ke';
  await check(`POST /api/ess/auth/login (${essEmail})`, async () => {
    const res = await fetch(`${BASE}/api/ess/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: essEmail, password: PASSWORD }),
    });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('no ess session cookie');
    essCookie = setCookie.split(';')[0];
  });

  const essAuth = { Cookie: essCookie };
  await check('GET /api/ess/leave/balances', async () => {
    const res = await fetch(`${BASE}/api/ess/leave/balances`, { headers: essAuth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  await check('GET /api/ess/auth/me', async () => {
    const res = await fetch(`${BASE}/api/ess/auth/me`, { headers: essAuth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(` - ${f.label}: ${f.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
