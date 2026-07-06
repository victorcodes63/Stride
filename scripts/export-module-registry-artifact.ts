/**
 * MOD-06: Export module-registry.ts to shared JSON for control-plane consumption.
 * Run: npx tsx scripts/export-module-registry-artifact.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  MODULE_KEYS,
  MODULE_REGISTRY,
  MODULE_BUCKET,
  buildModuleUiGroups,
} from '../src/lib/module-registry';

const OUT = path.join(import.meta.dirname, '../../shared/module-registry-artifact.json');

const artifact = {
  version: 1,
  generatedAt: new Date().toISOString(),
  keys: [...MODULE_KEYS],
  modules: MODULE_REGISTRY.map((row) => ({
    key: row.key,
    label: row.label,
    bucket: row.bucket,
    canDisable: row.canDisable,
    domainId: row.domainId,
    envVar: row.envVar,
    requires: row.requires ?? [],
  })),
  bucket: MODULE_BUCKET,
  uiGroups: buildModuleUiGroups(),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Wrote ${OUT} (${MODULE_KEYS.length} modules)`);
