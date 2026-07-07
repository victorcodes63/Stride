#!/usr/bin/env node
/**
 * SPD-00 (RAV-273) — warm heaviest dashboard/API routes and dump slow-query report.
 *
 * Requires a running dev server with PRISMA query timing enabled (default in development).
 *
 * Usage:
 *   npm run spd:benchmark
 *   SMOKE_BASE_URL=http://localhost:3000 SMOKE_LOGIN_EMAIL=... SMOKE_LOGIN_PASSWORD=... npm run spd:benchmark
 */

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const LOGIN_EMAIL = process.env.SMOKE_LOGIN_EMAIL || process.env.DEMO_UNIFIED_ADMIN_EMAIL;
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || process.env.NEXT_PUBLIC_DEMO_PASSWORD;

/** API routes backing dashboard + heaviest module pages. */
const BENCHMARK_ROUTES = [
  { label: 'Dashboard bootstrap', path: '/api/dashboard/bootstrap' },
  { label: 'Dashboard overview (all)', path: '/api/dashboard/overview' },
  { label: 'Dashboard overview (core)', path: '/api/dashboard/overview?metricsOnly=1&slice=core' },
  { label: 'Dashboard overview (details)', path: '/api/dashboard/overview?metricsOnly=1&slice=details' },
  { label: 'Employees list', path: '/api/outsourcing/employees' },
  { label: 'Outsourcing clients', path: '/api/outsourcing/clients' },
  { label: 'Outsourcing overview', path: '/api/outsourcing/overview' },
  { label: 'Payroll runs', path: '/api/outsourcing/payroll' },
  { label: 'Disciplinary cases', path: '/api/disciplinary/cases' },
  { label: 'Disciplinary SLA', path: '/api/disciplinary/sla-summary' },
  { label: 'Grievances', path: '/api/grievances' },
  { label: 'Projects dashboard', path: '/api/projects/dashboard' },
  { label: 'Fleet overview', path: '/api/fleet/overview' },
  { label: 'Accounts invoices', path: '/api/accounts/invoices' },
  { label: 'Performance scorecards', path: '/api/performance/scorecards' },
  { label: 'Notifications', path: '/api/notifications' },
];

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login() {
  assert(LOGIN_EMAIL, 'Missing SMOKE_LOGIN_EMAIL or DEMO_UNIFIED_ADMIN_EMAIL');
  assert(LOGIN_PASSWORD, 'Missing SMOKE_LOGIN_PASSWORD or NEXT_PUBLIC_DEMO_PASSWORD');

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD, rememberMe: false }),
  });
  const payload = await jsonOrText(res);
  assert(res.ok, `Login failed: ${JSON.stringify(payload)}`);
  const cookieHeader = res.headers.get('set-cookie');
  assert(cookieHeader, 'No session cookie returned');
  return cookieHeader.split(';')[0];
}

async function resetTiming() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(`${BASE_URL}/api/dev/query-timing?action=reset`, { method: 'POST' });
    if (res.ok) return true;
    if (res.status === 404) {
      console.warn('Query timing endpoint unavailable — is the dev server running with NODE_ENV=development?');
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('Failed to reset query timing counters');
}

async function hitRoute(cookie, route) {
  const started = performance.now();
  const res = await fetch(`${BASE_URL}${route.path}`, {
    headers: { Cookie: cookie },
  });
  const elapsed = Math.round(performance.now() - started);
  const body = await jsonOrText(res);
  return { elapsed, ok: res.ok, status: res.status, body };
}

async function fetchReport() {
  const res = await fetch(`${BASE_URL}/api/dev/query-timing`);
  assert(res.ok, 'Failed to fetch query timing report');
  return res.json();
}

async function main() {
  console.log(`\nSPD-00 benchmark → ${BASE_URL}\n`);

  const timingAvailable = await resetTiming();
  const cookie = await login();
  console.log('✓ Authenticated\n');

  const routeLatencies = [];

  for (const route of BENCHMARK_ROUTES) {
    const result = await hitRoute(cookie, route);
    const status = result.ok ? 'OK' : `HTTP ${result.status}`;
    console.log(`${result.ok ? '✓' : '✗'} ${route.label} — ${result.elapsed}ms (${status})`);
    routeLatencies.push({
      label: route.label,
      path: route.path,
      httpMs: result.elapsed,
      ok: result.ok,
    });
    if (!result.ok && typeof result.body === 'object' && result.body?.error) {
      console.log(`  ↳ ${result.body.error}`);
    }
  }

  console.log('\n--- HTTP route latency (wall clock) ---\n');
  routeLatencies
    .sort((a, b) => b.httpMs - a.httpMs)
    .forEach((row, index) => {
      console.log(`${index + 1}. ${row.httpMs}ms ${row.path}${row.ok ? '' : ' [failed]'}`);
    });

  if (!timingAvailable) {
    console.log('\nPrisma slow-query report unavailable.\n');
    process.exit(0);
  }

  const report = await fetchReport();
  console.log('\n--- Prisma slow queries (>100ms) ---\n');
  console.log(`Events: ${report.slowQueryEventCount}\n`);

  report.rankedRoutes.forEach((row, index) => {
    console.log(
      `${index + 1}. route=${row.route} max=${row.maxMs}ms avg=${row.avgMs}ms slowQueries=${row.slowQueryCount}`,
    );
  });

  console.log('\nTop queries:');
  report.rankedQueries.slice(0, 15).forEach((row, index) => {
    const query = row.query.replace(/\s+/g, ' ').slice(0, 100);
    console.log(`${index + 1}. ${row.maxMs}ms [${row.route}] ${query}`);
  });

  const markdownRes = await fetch(`${BASE_URL}/api/dev/query-timing?format=markdown`, {
    method: 'POST',
  });
  const markdown = await markdownRes.text();
  console.log('\n--- Markdown report (paste into Linear) ---\n');
  console.log(markdown);
}

main().catch((error) => {
  console.error('\nSPD-00 benchmark: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
