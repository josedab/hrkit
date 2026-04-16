import { describe, expect, it } from 'vitest';
import { filterArtifacts } from '../artifact-filter.js';
import { RR_WITH_ARTIFACTS } from './fixtures/index.js';

describe('filterArtifacts', () => {
  it('returns empty result for empty input', () => {
    const result = filterArtifacts([]);
    expect(result.filtered).toEqual([]);
    expect(result.artifactRate).toBe(0);
  });

  it('returns single value unchanged', () => {
    const result = filterArtifacts([800]);
    expect(result.filtered).toEqual([800]);
    expect(result.artifactRate).toBe(0);
  });

  it('passes clean RR intervals through unchanged', () => {
    const clean = [800, 810, 790, 820, 805];
    const result = filterArtifacts(clean);

    expect(result.filtered).toEqual(clean);
    expect(result.artifactRate).toBe(0);
  });

  it('removes artifacts with default threshold', () => {
    const result = filterArtifacts(RR_WITH_ARTIFACTS, { strategy: 'remove' });

    // Should remove the 1500, 300, and 1600 artifacts
    expect(result.filtered).not.toContain(1500);
    expect(result.filtered).not.toContain(300);
    expect(result.filtered).not.toContain(1600);
    expect(result.artifactRate).toBeGreaterThan(0);
  });

  it('interpolates artifacts instead of removing', () => {
    const result = filterArtifacts(RR_WITH_ARTIFACTS, { strategy: 'interpolate' });

    // Length should be preserved
    expect(result.filtered).toHaveLength(RR_WITH_ARTIFACTS.length);
    // Artifacts should be replaced with interpolated values
    expect(result.artifactRate).toBeGreaterThan(0);
  });

  it('respects custom threshold', () => {
    const data = [800, 810, 900, 810, 800]; // 900 is 12.5% deviation
    const strictResult = filterArtifacts(data, { threshold: 0.1, strategy: 'remove' });
    const lenientResult = filterArtifacts(data, { threshold: 0.2, strategy: 'remove' });

    expect(strictResult.artifactRate).toBeGreaterThan(lenientResult.artifactRate);
  });

  it('handles all-artifact edge case', () => {
    const allArtifact = [100, 2000, 50, 3000, 75];
    const result = filterArtifacts(allArtifact, { strategy: 'remove' });

    // Should still return something reasonable
    expect(result.artifactRate).toBeGreaterThan(0);
  });
});
