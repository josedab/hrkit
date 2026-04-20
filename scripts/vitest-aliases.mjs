import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Build a vitest alias map by scanning packages/&#42;/package.json for `name`.
 * Used by both vitest.config.ts and vitest.workspace.ts to keep a single
 * source of truth for path aliases — adding a new @hrkit/&#42; package no longer
 * requires editing two config files.
 *
 * @param {string} rootDir - Repo root containing the `packages/` directory.
 * @returns {Record<string, string>} Map of `{ '@hrkit/foo': '<abs>/packages/foo/src/index.ts' }`.
 */
export function buildAliases(rootDir) {
  const packagesDir = path.resolve(rootDir, 'packages');
  /** @type {Record<string, string>} */
  const aliases = {};

  for (const entry of readdirSync(packagesDir)) {
    const pkgPath = path.join(packagesDir, entry);
    if (!statSync(pkgPath).isDirectory()) continue;
    const pkgJsonPath = path.join(pkgPath, 'package.json');
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    } catch {
      continue;
    }
    if (!pkgJson.name) continue;
    aliases[pkgJson.name] = path.join(pkgPath, 'src/index.ts');
  }

  // Preserve the explicit subpath alias used by some test files.
  aliases['@hrkit/core/profiles'] = path.resolve(packagesDir, 'core/src/profiles/index.ts');

  return aliases;
}
