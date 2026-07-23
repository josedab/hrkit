#!/usr/bin/env node
/**
 * Synchronize package-page metadata while preserving curated features and examples.
 *
 * Run via `pnpm docs:packages`. CI checks drift via `pnpm docs:packages:check`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CUSTOM_CONTENT_START = '## Key features';
const CUSTOM_CONTENT_END = '## API reference';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(repoRoot, 'packages');
const outputDir = join(repoRoot, 'website/docs/packages');

function readPublishedPackages() {
  return readdirSync(packagesDir)
    .sort()
    .filter((slug) => existsSync(join(packagesDir, slug, 'package.json')))
    .map((slug) => ({
      slug,
      metadata: JSON.parse(readFileSync(join(packagesDir, slug, 'package.json'), 'utf8')),
    }))
    .filter(({ metadata }) => metadata.private !== true);
}

function defaultCustomContent(name, slug) {
  return `${CUSTOM_CONTENT_START}

See the package [README](https://github.com/josedab/hrkit/tree/main/packages/${slug}#readme) for its supported features.

## Quick example

See the [examples directory](https://github.com/josedab/hrkit/tree/main/examples) and the package [README](https://github.com/josedab/hrkit/tree/main/packages/${slug}#readme) for runnable ${name} code.`;
}

export function extractCustomContent(existingPage, name, slug) {
  if (existingPage === undefined) return defaultCustomContent(name, slug);

  const start = existingPage.indexOf(CUSTOM_CONTENT_START);
  const end = existingPage.indexOf(CUSTOM_CONTENT_END);
  if (start === -1 || end === -1 || start >= end) {
    throw new Error(
      `Cannot preserve curated content in website/docs/packages/${slug}.md: expected "${CUSTOM_CONTENT_START}" before "${CUSTOM_CONTENT_END}".`,
    );
  }

  return existingPage.slice(start, end).trimEnd();
}

export function renderPackagePage(metadata, slug, customContent) {
  const name = metadata.name;
  const description = metadata.description ?? '';

  return `---
title: ${JSON.stringify(name)}
description: ${JSON.stringify(description)}
---

# ${name}

${description}

## Install

\`\`\`bash
pnpm add ${name}
\`\`\`

${customContent}

## API reference

The full generated API reference is available under [API Reference → Generated (TypeDoc)](/docs/api).

## Source

[\`packages/${slug}\`](https://github.com/josedab/hrkit/tree/main/packages/${slug}) · v${metadata.version} · [npm](https://www.npmjs.com/package/${name})
`;
}

export function synchronizePackagePages({ write }) {
  mkdirSync(outputDir, { recursive: true });

  const stalePages = [];
  const packages = readPublishedPackages();
  for (const { slug, metadata } of packages) {
    const target = join(outputDir, `${slug}.md`);
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
    const customContent = extractCustomContent(existing, metadata.name, slug);
    const expected = renderPackagePage(metadata, slug, customContent);

    if (existing === expected) continue;
    stalePages.push(slug);
    if (write) writeFileSync(target, expected);
  }

  return {
    packageCount: packages.length,
    stalePages,
  };
}

function runCli() {
  const checkOnly = process.argv.includes('--check');
  const { packageCount, stalePages } = synchronizePackagePages({ write: !checkOnly });

  if (checkOnly && stalePages.length > 0) {
    console.error(`Package documentation is out of sync: ${stalePages.join(', ')}`);
    console.error('Run `pnpm docs:packages` and commit the result.');
    process.exitCode = 1;
    return;
  }

  const action = checkOnly ? 'Checked' : 'Synchronized';
  console.log(`${action} ${packageCount} package pages; ${stalePages.length} page(s) ${checkOnly ? 'need updates' : 'updated'}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
