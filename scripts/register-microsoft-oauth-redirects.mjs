#!/usr/bin/env node
/**
 * Add Stride production OAuth redirect URIs to the Microsoft Entra app registration.
 *
 * Requires Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
 *
 * Usage:
 *   az login
 *   node scripts/register-microsoft-oauth-redirects.mjs [app-client-id]
 *
 * Default client id matches the Stride Platform SSO app (from AADSTS50011 error).
 */

import { execSync } from 'node:child_process';

const APP_ID = process.argv[2]?.trim() || '13bebbef-1e23-4b9f-bdf1-adde88bf95f9';

const REQUIRED_URIS = [
  'https://app.getstride.co.ke/api/auth/microsoft/callback',
  'https://app.getstride.co.ke/api/ess/auth/microsoft/callback',
  'http://localhost:3000/api/auth/microsoft/callback',
  'http://localhost:3000/api/ess/auth/microsoft/callback',
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

try {
  run('az --version');
} catch {
  console.error('Azure CLI (az) is required. Install: https://aka.ms/installazurecli');
  process.exit(1);
}

try {
  run('az account show');
} catch {
  console.error('Run `az login` first.');
  process.exit(1);
}

const objectId = run(
  `az ad app show --id ${APP_ID} --query id -o tsv`,
);
const existingJson = run(
  `az ad app show --id ${APP_ID} --query web.redirectUris -o json`,
);
const existing = JSON.parse(existingJson || '[]');
const merged = [...new Set([...existing, ...REQUIRED_URIS])];

run(
  `az ad app update --id ${objectId} --web-redirect-uris ${merged.map((u) => `"${u}"`).join(' ')}`,
);

console.log('Updated redirect URIs for app', APP_ID);
for (const uri of REQUIRED_URIS) {
  console.log('  ✓', uri);
}
