#!/usr/bin/env node
/**
 * RAV-130 — Verify scope of "verify/complete" modules (procurement, projects, legal, statements).
 * Exercises live APIs where they exist; records confirmed gaps for roadmap-only surfaces.
 */
const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_LOGIN_EMAIL || 'admin@demo.getstride.co.ke';
const PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!';

const results = [];
const gaps = [];

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

function recordGap(area, finding) {
  gaps.push({ area, finding });
  console.log(`  ↳ GAP [${area}]: ${finding}`);
}

async function main() {
  console.log(`\nRAV-130 module scope verify → ${BASE}\n`);

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

  const auth = { Cookie: cookie, 'Content-Type': 'application/json' };

  // --- Procurement (RAV-79) ---
  let vendorId = null;
  await check('GET /api/procurement/vendors', async () => {
    const res = await fetch(`${BASE}/api/procurement/vendors`, { headers: auth });
    const body = await json(res);
    if (res.status === 403) throw new Error('procurement module disabled');
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (!Array.isArray(body.vendors)) throw new Error('expected vendors array');
    vendorId = body.vendors[0]?.id ?? null;
  });

  let prId = null;
  await check('POST /api/procurement/purchase-requests (create draft)', async () => {
    const res = await fetch(`${BASE}/api/procurement/purchase-requests`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        title: `RAV-130 QA ${Date.now()}`,
        department: 'Finance',
        justification: 'Automated scope verification — safe to delete.',
        currency: 'KES',
        vendorId: vendorId || undefined,
        items: [{ item: 'Office supplies', quantity: 2, unitPrice: 1500 }],
      }),
    });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    prId = body.id;
    if (!prId) throw new Error('missing id');
  });

  await check('PATCH PR submit → approve flow', async () => {
    if (!prId) throw new Error('no PR from prior step');
    let res = await fetch(`${BASE}/api/procurement/purchase-requests/${prId}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ action: 'submit' }),
    });
    if (!res.ok) throw new Error(`submit: ${JSON.stringify(await json(res))}`);
    res = await fetch(`${BASE}/api/procurement/purchase-requests/${prId}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ action: 'approve' }),
    });
    if (!res.ok) throw new Error(`approve: ${JSON.stringify(await json(res))}`);
    res = await fetch(`${BASE}/api/procurement/purchase-requests/${prId}`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (body.request?.status !== 'approved') {
      throw new Error(`expected approved, got ${body.request?.status}`);
    }
  });

  recordGap(
    'procurement',
    'PR create/submit/approve works via API (fixed organizationId on create). No LPO model or /api/procurement/lpos — /dashboard/procurement/lpos is ModuleRoadmapPage only.',
  );

  // --- Statements (RAV-76 / accounts) ---
  await check('GET /api/accounts/statements (client)', async () => {
    const res = await fetch(`${BASE}/api/accounts/statements?type=client`, { headers: auth });
    const body = await json(res);
    if (res.status === 403) throw new Error('accounts access denied for user');
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (!Array.isArray(body.statements)) throw new Error('expected statements array');
    if (body.statements.length === 0) {
      recordGap('statements', 'API is real (invoice/payment ledger) but no seeded client statements in demo DB.');
    }
  });

  await check('GET /api/accounts/statements (vendor)', async () => {
    const res = await fetch(`${BASE}/api/accounts/statements?type=vendor`, { headers: auth });
    const body = await json(res);
    if (res.status === 403) return;
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (!Array.isArray(body.statements)) throw new Error('expected statements array');
  });

  // --- Legal hub subset: credentials + company documents (RAV-74/81) ---
  await check('GET /api/credentials', async () => {
    const res = await fetch(`${BASE}/api/credentials`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (!Array.isArray(body.credentials) && !Array.isArray(body)) {
      throw new Error('unexpected credentials shape');
    }
  });

  await check('GET /api/company-documents', async () => {
    const res = await fetch(`${BASE}/api/company-documents`, { headers: auth });
    const body = await json(res);
    if (!res.ok) throw new Error(JSON.stringify(body));
    if (!Array.isArray(body.documents)) throw new Error('expected documents array');
  });

  recordGap(
    'legal',
    '/dashboard/legal is ModuleHomeContent hub. Obligations register (/dashboard/legal/obligations) is roadmap. Live: credentials + company-documents APIs.',
  );

  // --- Projects (RAV-80/84) — static scope ---
  recordGap(
    'projects',
    'No /api/projects routes. /dashboard/projects uses ModuleHomeContent; board + tasks are ModuleRoadmapPage only — UI shell, no backend.',
  );

  // --- Dashboard pages render (smoke GET) ---
  const pages = [
    '/dashboard/procurement/purchase-requests',
    '/dashboard/procurement/lpos',
    '/dashboard/projects',
    '/dashboard/projects/board',
    '/dashboard/legal',
    '/dashboard/accounts/statements',
    '/dashboard/credentials',
  ];

  for (const path of pages) {
    await check(`GET ${path} (HTML 200)`, async () => {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: 'follow' });
      if (res.status === 401 || res.url.includes('/login')) throw new Error('redirected to login');
      if (!res.ok) throw new Error(`status ${res.status}`);
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} API/page checks passed`);
  console.log(`\nConfirmed gaps (${gaps.length}):`);
  for (const g of gaps) console.log(`  • [${g.area}] ${g.finding}`);

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
