#!/usr/bin/env node
/**
 * Prevents corrupted `.next` from running `next build` while `next dev` is active.
 * Used by package.json prebuild and agent recovery scripts.
 */
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_PORTS = [3000, 3001];

function pidsOnPort(port) {
  try {
    return execSync(`lsof -ti:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((pid) => Number(pid));
  } catch {
    return [];
  }
}

function stopDev() {
  const stopped = new Set();
  for (const port of DEV_PORTS) {
    for (const pid of pidsOnPort(port)) {
      if (stopped.has(pid)) continue;
      stopped.add(pid);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`[next-dev-guard] Stopped PID ${pid} (port ${port})`);
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
          console.log(`[next-dev-guard] Force-stopped PID ${pid} (port ${port})`);
        } catch {
          /* already gone */
        }
      }
    }
  }
  if (stopped.size > 0) {
    try {
      execSync('sleep 0.8');
    } catch {
      /* windows / no sleep */
    }
  }
  return stopped.size;
}

function clearNextCache() {
  execSync('rm -rf .next', { cwd: root, stdio: 'inherit' });
  console.log('[next-dev-guard] Removed .next cache');
}

function startDev() {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  console.log(`[next-dev-guard] Started dev server (PID ${child.pid})`);
}

const command = process.argv[2] ?? 'stop';

switch (command) {
  case 'stop':
    stopDev();
    break;
  case 'recover':
    stopDev();
    clearNextCache();
    startDev();
    break;
  case 'start':
    startDev();
    break;
  default:
    console.error(`[next-dev-guard] Unknown command: ${command}`);
    process.exit(1);
}
