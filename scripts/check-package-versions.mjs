#!/usr/bin/env node
import { synchronizePackageVersions } from './sync-package-versions.mjs';

const { packageCount, stalePackages } = synchronizePackageVersions({ write: false });

if (stalePackages.length > 0) {
  console.error(`Generated version modules are out of sync: ${stalePackages.join(', ')}`);
  console.error('Run `pnpm sync:versions` and commit the result.');
  process.exitCode = 1;
} else {
  console.log(`Generated version modules are up to date (${packageCount} packages).`);
}
