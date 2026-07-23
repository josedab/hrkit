#!/usr/bin/env node
import { synchronizePackagePages } from './gen-package-pages.mjs';

const { packageCount, stalePages } = synchronizePackagePages({ write: false });

if (stalePages.length > 0) {
  console.error(`Package documentation is out of sync: ${stalePages.join(', ')}`);
  console.error('Run `pnpm docs:packages` and commit the result.');
  process.exitCode = 1;
} else {
  console.log(`Package documentation is up to date (${packageCount} pages).`);
}
