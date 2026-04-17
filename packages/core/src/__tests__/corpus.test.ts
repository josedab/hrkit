import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyFixture } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', '..', '..', '..', 'fixtures', 'conformance');

describe('conformance corpus', () => {
  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json'));

  it('loads at least one fixture', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`fixture passes: ${file}`, () => {
      const fx = JSON.parse(readFileSync(join(CORPUS, file), 'utf8'));
      const r = verifyFixture(fx);
      if (!r.ok) {
        // surface helpful context on failure
        // eslint-disable-next-line no-console
        console.error(file, JSON.stringify(r.failures, null, 2));
      }
      expect(r.ok).toBe(true);
    });
  }
});
