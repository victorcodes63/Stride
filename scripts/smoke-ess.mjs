#!/usr/bin/env node
/**
 * RAV-284 — ESS surface smoke (public + authenticated routes).
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 \
 *   SMOKE_LOGIN_EMAIL=admin@example.com \
 *   SMOKE_LOGIN_PASSWORD='...' \
 *   npm run smoke:ess
 */
const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const LOGIN_EMAIL = process.env.SMOKE_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function step(label, fn) {
  await fn();
  console.log(`✓ ${label}`);
}

async function main() {
  console.log(`\nESS smoke test → ${BASE_URL}\n`);
  assert(LOGIN_EMAIL, 'Missing SMOKE_LOGIN_EMAIL');
  assert(LOGIN_PASSWORD, 'Missing SMOKE_LOGIN_PASSWORD');

  await step('ESS login page', async () => {
    const res = await fetch(`${BASE_URL}/ess/login`);
    assert(res.ok, `/ess/login returned ${res.status}`);
  });

  let sessionCookie = '';
  await step('Staff login for ESS session', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD, rememberMe: false }),
    });
    const payload = await jsonOrText(res);
    assert(res.ok, `Login failed: ${JSON.stringify(payload)}`);
    const cookieHeader = res.headers.get('set-cookie');
    assert(cookieHeader, 'No session cookie returned');
    sessionCookie = cookieHeader.split(';')[0];
  });

  await step('ESS home', async () => {
    const res = await fetch(`${BASE_URL}/ess`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    assert(res.status === 200 || (res.status >= 300 && res.status < 400), `/ess returned ${res.status}`);
  });

  await step('ESS leave balances API', async () => {
    const res = await fetch(`${BASE_URL}/api/ess/leave/balances`, {
      headers: { Cookie: sessionCookie },
    });
    const data = await jsonOrText(res);
    assert(res.ok || res.status === 404, `Leave balances failed: ${JSON.stringify(data)}`);
  });

  console.log('\nESS smoke test: PASS\n');
}

main().catch((error) => {
  console.error('\nESS smoke test: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
