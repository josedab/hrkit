#!/usr/bin/env node
/**
 * Generate per-device SVG badges from the conformance corpus.
 *
 * Writes one `<device-slug>.svg` under `fixtures/conformance/badges/` per
 * fixture, plus a single `summary.svg` for the README. Badges follow
 * shields.io's flat style. Pure Node, no external deps.
 */

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFixture } from '../packages/core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'fixtures', 'conformance');
const BADGE_DIR = join(CORPUS_DIR, 'badges');

if (!existsSync(CORPUS_DIR)) {
  process.stderr.write(`corpus dir not found: ${CORPUS_DIR}\n`);
  process.exit(1);
}
mkdirSync(BADGE_DIR, { recursive: true });

const COLORS = { pass: '#4c1', fail: '#e05d44', partial: '#dfb317' };

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

// Approximate text width — Verdana 11px averages ~6.5 px/char.
function textWidth(s) {
  return Math.max(20, Math.round(s.length * 6.5) + 10);
}

function badge(label, value, color) {
  const lw = textWidth(label);
  const vw = textWidth(value);
  const total = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${escapeXml(label)}</text>
    <text x="${lw + vw / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>
`;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.json'));
let total = 0;
let totalPassed = 0;
let devicesPassed = 0;

for (const file of files) {
  const fx = JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8'));
  let r;
  try {
    r = verifyFixture(fx);
  } catch (err) {
    r = { ok: false, total: 0, passed: 0, failures: [{ reason: err.message }] };
  }
  const device = `${fx.device?.brand ?? 'unknown'} ${fx.device?.model ?? ''}`.trim();
  const value = r.ok ? `${r.passed}/${r.total} ✓` : `${r.passed}/${r.total} ✗`;
  const color = r.ok ? COLORS.pass : r.passed > 0 ? COLORS.partial : COLORS.fail;
  writeFileSync(join(BADGE_DIR, `${slug(device)}.svg`), badge(device, value, color));
  total += r.total;
  totalPassed += r.passed;
  if (r.ok) devicesPassed++;
  process.stdout.write(`  badge: ${slug(device)}.svg  ${value}\n`);
}

const summaryColor = devicesPassed === files.length ? COLORS.pass : devicesPassed > 0 ? COLORS.partial : COLORS.fail;
writeFileSync(
  join(BADGE_DIR, 'summary.svg'),
  badge('conformance', `${devicesPassed}/${files.length} devices · ${totalPassed}/${total} checks`, summaryColor),
);
process.stdout.write(`  badge: summary.svg  ${devicesPassed}/${files.length} devices, ${totalPassed}/${total} checks\n`);
