#!/usr/bin/env node
/**
 * Regenerate website/docs/packages/<name>.md for every published @hrkit/* package.
 * Reads metadata from each package.json and emits a uniform landing page.
 *
 * Run via `pnpm docs:packages`. CI guards drift via `pnpm docs:packages:check`.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const pkgDir = join(repoRoot, 'packages');
const outDir = join(repoRoot, 'website/docs/packages');

const slugs = readdirSync(pkgDir).filter((s) => existsSync(join(pkgDir, s, 'package.json')));
mkdirSync(outDir, { recursive: true });

const pages = [];
for (const slug of slugs.sort()) {
  const pj = JSON.parse(readFileSync(join(pkgDir, slug, 'package.json'), 'utf8'));
  if (pj.private) continue; // skip private packages
  const desc = (pj.description ?? '').replace(/"/g, '\\"');
  const md = `---
title: "${pj.name}"
description: "${desc}"
---

# ${pj.name}

${pj.description ?? ''}

## Install

\`\`\`bash
pnpm add ${pj.name}
\`\`\`

## Quick example

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/${slug}#readme) for runnable code.

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[\`packages/${slug}\`](https://github.com/josedab/hrkit/tree/main/packages/${slug}) · v${pj.version} · [npm](https://www.npmjs.com/package/${pj.name})
`;
  const outFile = join(outDir, `${slug}.md`);
  writeFileSync(outFile, md);
  pages.push(slug);
}

console.log(`Generated ${pages.length} landing pages → ${outDir}`);
console.log(pages.map((s) => `  - ${s}`).join('\n'));
