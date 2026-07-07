#!/usr/bin/env node
/**
 * RAV-284 — Control plane surface smoke (health + auth gate).
 *
 * Usage:
 *   SMOKE_CP_BASE_URL=http://localhost:3001 \
 *   SMOKE_CP_EMAIL=operator@example.com \
 *   SMOKE_CP_PASSWORD='...' \
 *   npm run smoke:control-plane
 */
const BASE_URL = (process.env.SMOKE_CP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const LOGIN_EMAIL = process.env.SMOKE_CP_EMAIL || process.env.SMOKE_LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.SMOKE_CP_PASSWORD || process.env.SMOKE_LOGIN_PASSWORD;

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
  console.log(`\nControl plane smoke test → ${BASE_URL}\n`);

  await step('Login page', async () => {
    const res = await fetch(`${BASE_URL}/login`);
    assert(res.ok, `/login returned ${res.status}`);
  });

  await step('Protected route redirects unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    assert(
      res.status === 307 || res.status === 302 || res.status === 303,
      `Expected redirect for /, got ${res.status}`,
    );
  });

  if (LOGIN_EMAIL && LOGIN_PASSWORD) {
    let sessionCookie = '';
    await step('Operator login', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
      });
      const payload = await jsonOrText(res);
      assert(res.ok, `Login failed: ${JSON.stringify(payload)}`);
      const cookieHeader = res.headers.get('set-cookie');
      assert(cookieHeader, 'No session cookie returned');
      sessionCookie = cookieHeader.split(';')[0];
    });

    for (const path of ['/', '/customers', '/fleet', '/revenue']) {
      await step(`Authenticated ${path}`, async () => {
        const res = await fetch(`${BASE_URL}${path}`, {
          headers: { Cookie: sessionCookie },
          redirect: 'manual',
        });
        assert(res.status === 200, `${path} returned ${res.status}`);
      });
    }
  } else {
    console.log('○ SMOKE_CP_EMAIL/PASSWORD not set — auth routes skipped');
  }

  console.log('\nControl plane smoke test: PASS\n');
}

main().catch((error) => {
  console.error('\nControl plane smoke test: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
