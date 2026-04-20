#!/usr/bin/env node
// CI guard: fail if version.ts files are out of sync with package.json.
import { execSync } from 'node:child_process';

execSync('node scripts/sync-package-versions.mjs', { stdio: 'inherit' });
const out = execSync('git status --porcelain packages/*/src/version.ts', { encoding: 'utf8' });
if (out.trim().length > 0) {
  console.error('\nversion.ts files are out of sync with package.json. Run `pnpm sync:versions` and commit:');
  console.error(out);
  process.exit(1);
}
console.log('sync:versions:check — OK');
