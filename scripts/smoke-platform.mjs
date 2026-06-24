#!/usr/bin/env node
/**
 * Platform smoke test for a dedicated client deployment.
 * Validates auth, deployment config, core HR API, and optional ATS/payroll modules.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://hr.client.co.ke \
 *   SMOKE_LOGIN_EMAIL=admin@client.co.ke \
 *   SMOKE_LOGIN_PASSWORD='...' \
 *   npm run smoke:platform
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
  console.log(`\nPlatform smoke test → ${BASE_URL}\n`);
  assert(LOGIN_EMAIL, 'Missing SMOKE_LOGIN_EMAIL');
  assert(LOGIN_PASSWORD, 'Missing SMOKE_LOGIN_PASSWORD');

  let sessionCookie = '';

  await step('Deployment config', async () => {
    const res = await fetch(`${BASE_URL}/api/config/deployment`);
    const data = await jsonOrText(res);
    assert(res.ok, `Config failed: ${JSON.stringify(data)}`);
    assert(data.modules?.core === true, 'Core module must be enabled');
    assert(typeof data.orgName === 'string', 'orgName missing from deployment config');
    assert(typeof data.defaultEntityId === 'string', 'defaultEntityId missing from deployment config');
    assert(Array.isArray(data.entities), 'entities array missing from deployment config');
  });

  await step('Public entities config', async () => {
    const res = await fetch(`${BASE_URL}/api/config/entities`);
    const data = await jsonOrText(res);
    assert(res.ok, `Entities config failed: ${JSON.stringify(data)}`);
    assert(Array.isArray(data.entities), 'entities should be an array');
    assert(typeof data.defaultEntityId === 'string', 'defaultEntityId required');
    assert(typeof data.showSwitcher === 'boolean', 'showSwitcher flag required');
    if (data.showSwitcher) {
      assert(data.entities.length >= 2, 'Switcher visible requires 2+ active entities');
    } else {
      assert(data.entities.length >= 1, 'At least one entity must be configured');
    }
  });

  await step('Staff login', async () => {
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

  await step('Current user (/api/auth/me)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: sessionCookie } });
    const me = await jsonOrText(res);
    assert(res.ok, `me failed: ${JSON.stringify(me)}`);
    assert(me.email, 'Expected user email');
  });

  await step('Employees list (core HR)', async () => {
    const res = await fetch(`${BASE_URL}/api/outsourcing/employees`, {
      headers: { Cookie: sessionCookie },
    });
    const data = await jsonOrText(res);
    assert(res.ok, `Employees failed: ${JSON.stringify(data)}`);
    assert(Array.isArray(data), 'Employees response should be an array');
  });

  const configRes = await fetch(`${BASE_URL}/api/config/deployment`);
  const config = await jsonOrText(configRes);

  if (config.modules?.payroll) {
    await step('Payroll runs list', async () => {
      const res = await fetch(`${BASE_URL}/api/outsourcing/payroll`, {
        headers: { Cookie: sessionCookie },
      });
      const data = await jsonOrText(res);
      assert(res.ok, `Payroll failed: ${JSON.stringify(data)}`);
    });
  } else {
    console.log('○ Payroll module disabled — skipped');
  }

  if (config.modules?.ats) {
    await step('Jobs list (ATS)', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, { headers: { Cookie: sessionCookie } });
      const data = await jsonOrText(res);
      assert(res.ok, `Jobs failed: ${JSON.stringify(data)}`);
      assert(Array.isArray(data), 'Jobs should be an array');
    });
  } else {
    console.log('○ ATS module disabled — skipped');
  }

  if (config.modules?.ats === false) {
    await step('ATS routes blocked when module disabled', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, { headers: { Cookie: sessionCookie } });
      assert(res.status === 403, `Expected 403 for disabled ATS, got ${res.status}`);
    });
  }

  console.log('\nPlatform smoke test: PASS\n');
}

main().catch((error) => {
  console.error('\nPlatform smoke test: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
