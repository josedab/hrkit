#!/usr/bin/env node
/**
 * Validation corpus runner.
 *
 * Loads every JSON fixture under `fixtures/conformance/`, replays it through
 * the @hrkit GATT parser, and prints a per-device pass/fail report. Exits
 * with code 1 if any fixture fails — wire into CI.
 *
 *   node scripts/validate-corpus.mjs
 *   node scripts/validate-corpus.mjs --json   # machine-readable output
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFixture } from '../packages/core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'fixtures', 'conformance');
const jsonOut = process.argv.includes('--json');

if (!existsSync(CORPUS_DIR)) {
  process.stderr.write(`corpus dir not found: ${CORPUS_DIR}\n`);
  process.exit(1);
}

const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.json'));
const results = [];
let failed = 0;

for (const file of files) {
  const path = join(CORPUS_DIR, file);
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  try {
    const r = verifyFixture(fixture);
    results.push({
      file,
      device: `${fixture.device?.brand ?? '?'} ${fixture.device?.model ?? '?'}`,
      ok: r.ok,
      total: r.total,
      passed: r.passed,
      failures: r.failures.length,
    });
    if (!r.ok) failed++;
  } catch (err) {
    results.push({ file, device: 'unknown', ok: false, total: 0, passed: 0, failures: 1, error: err.message });
    failed++;
  }
}

if (jsonOut) {
  process.stdout.write(`${JSON.stringify({ summary: { files: files.length, failed }, results }, null, 2)}\n`);
} else {
  process.stdout.write(`hrkit conformance corpus — ${files.length} fixtures\n`);
  for (const r of results) {
    const mark = r.ok ? '✅' : '❌';
    process.stdout.write(`  ${mark}  ${r.file.padEnd(40)} ${r.device.padEnd(24)} ${r.passed}/${r.total}\n`);
    if (r.error) process.stdout.write(`       error: ${r.error}\n`);
  }
  process.stdout.write(`\n${failed === 0 ? 'all fixtures passed' : `${failed} fixture(s) failed`}\n`);
}

process.exit(failed === 0 ? 0 : 1);
