#!/usr/bin/env node
/**
 * Generate the "Certified Devices" docs page from the conformance corpus.
 *
 * Reads every JSON fixture under `fixtures/conformance/` and emits a single
 * markdown table at `website/docs/reference/certified-devices.md`. Run as
 * part of the website build (or in CI before `pnpm docs:build`).
 *
 * Pure Node, no external deps.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'fixtures', 'conformance');
const OUT = join(__dirname, '..', 'website', 'docs', 'reference', 'certified-devices.md');

if (!existsSync(CORPUS_DIR)) {
  process.stderr.write(`corpus dir not found: ${CORPUS_DIR}\n`);
  process.exit(1);
}

const fixtures = readdirSync(CORPUS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const raw = readFileSync(join(CORPUS_DIR, f), 'utf8');
    return { file: f, data: JSON.parse(raw) };
  })
  .filter((x) => x?.data?.device);

fixtures.sort((a, b) => {
  const ka = `${a.data.device.brand} ${a.data.device.model}`;
  const kb = `${b.data.device.brand} ${b.data.device.model}`;
  return ka.localeCompare(kb);
});

const slug = (f) => f.file.replace(/\.json$/, '');

const rows = fixtures
  .map((f) => {
    const d = f.data.device;
    const badgeUrl = `/badges/${slug(f)}.svg`;
    return `| ${d.brand} | ${d.model} | ${d.firmware ?? '—'} | \`${d.serviceUuid}\` / \`${d.characteristicUuid}\` | ![${slug(f)}](${badgeUrl}) |`;
  })
  .join('\n');

const md = `---
title: Certified Devices
description: Auto-generated list of BLE devices verified against the @hrkit conformance corpus.
---

# Certified Devices

> **Auto-generated.** Edit ${'`fixtures/conformance/`'} and re-run \`node scripts/generate-certified-devices.mjs\` — never edit this file by hand.

Every device below ships a frozen sample capture inside \`fixtures/conformance/\`.
The CI pipeline replays each capture against the @hrkit GATT parser on every PR and
fails the build on any drift, so this list reflects the **current verified state of
\`main\`**, not a manual claim.

| Brand | Model | Firmware | Service / Characteristic | Conformance |
|-------|-------|----------|--------------------------|-------------|
${rows}

## How a device gets on this list

1. Capture a representative ~10 s notification stream from the real device.
2. Add a fixture JSON to \`fixtures/conformance/\` with the brand, model,
   firmware, GATT identifiers, and the expected parsed output.
3. Open a PR — the CI ${'`validate-corpus`'} job replays the capture against
   ${'`@hrkit/core`'}'s parser and refuses to merge on any mismatch.

## Adding your own device

See [Contributing → Conformance Corpus](../guides/contributing.md) for the full
procedure including how to capture notifications safely (no PII), declare a
fixture schema version, and request a badge.
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md, 'utf8');
process.stdout.write(`✔ wrote ${OUT}  (${fixtures.length} devices)\n`);
