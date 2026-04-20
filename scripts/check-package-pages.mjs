#!/usr/bin/env node
/**
 * CI guard: regenerate landing pages and fail if anything changed.
 * Use this in CI to catch when a package.json edit drifts from docs.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

execSync('node scripts/gen-package-pages.mjs', { cwd: repoRoot, stdio: 'inherit' });
const diff = execSync('git status --porcelain website/docs/packages', { cwd: repoRoot, encoding: 'utf8' });
if (diff.trim().length > 0) {
  console.error('\n❌ website/docs/packages is out of sync with package metadata.');
  console.error('Run `pnpm docs:packages` and commit the result.\n');
  console.error(diff);
  process.exit(1);
}
console.log('✓ website/docs/packages is up to date.');
