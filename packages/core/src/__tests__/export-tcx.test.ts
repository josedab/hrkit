import { describe, it, expect } from 'vitest';
import { sessionToTCX } from '../export-tcx.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';
import type { Session } from '../types.js';

function makeSession(overrides?: Partial<Session>): Session {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime: new Date('2024-06-15T10:00:00Z').getTime(),
    endTime: new Date('2024-06-15T10:05:00Z').getTime(),
    samples: [
      { timestamp: new Date('2024-06-15T10:00:00Z').getTime(), hr: 72 },
      { timestamp: new Date('2024-06-15T10:01:00Z').getTime(), hr: 120 },
      { timestamp: new Date('2024-06-15T10:02:00Z').getTime(), hr: 150 },
      { timestamp: new Date('2024-06-15T10:03:00Z').getTime(), hr: 165 },
      { timestamp: new Date('2024-06-15T10:04:00Z').getTime(), hr: 140 },
      { timestamp: new Date('2024-06-15T10:05:00Z').getTime(), hr: 110 },
    ],
    rrIntervals: [],
    rounds: [],
    config: { maxHR: 185, restHR: 48 },
    ...overrides,
  };
}

describe('sessionToTCX', () => {
  it('produces valid XML structure', () => {
    const tcx = sessionToTCX(makeSession());

    expect(tcx).toContain('<?xml version="1.0"');
    expect(tcx).toContain('<TrainingCenterDatabase');
    expect(tcx).toContain('<Activities>');
    expect(tcx).toContain('<Activity Sport="Other">');
    expect(tcx).toContain('</TrainingCenterDatabase>');
  });

  it('includes all trackpoints with HR values', () => {
    const session = makeSession();
    const tcx = sessionToTCX(session);

    expect(tcx).toContain('<Trackpoint>');
    expect(tcx).toContain('<Value>72</Value>');
    expect(tcx).toContain('<Value>150</Value>');
    expect(tcx).toContain('<Value>110</Value>');

    const trackpointCount = (tcx.match(/<Trackpoint>/g) ?? []).length;
    expect(trackpointCount).toBe(6);
  });

  it('includes ISO timestamps', () => {
    const tcx = sessionToTCX(makeSession());
    expect(tcx).toContain('2024-06-15T10:00:00.000Z');
  });

  it('includes duration', () => {
    const tcx = sessionToTCX(makeSession());
    expect(tcx).toContain('<TotalTimeSeconds>300.0</TotalTimeSeconds>');
  });

  it('accepts custom sport type', () => {
    const tcx = sessionToTCX(makeSession(), { sport: 'Running' });
    expect(tcx).toContain('Sport="Running"');
  });

  it('escapes XML characters in sport', () => {
    const tcx = sessionToTCX(makeSession(), { sport: 'Jiu & Jitsu <Sport>' });
    expect(tcx).toContain('Jiu &amp; Jitsu &lt;Sport&gt;');
    expect(tcx).not.toContain('Jiu & Jitsu <Sport>');
  });

  it('handles empty session', () => {
    const tcx = sessionToTCX(makeSession({ samples: [] }));
    expect(tcx).toContain('<Track>');
    expect(tcx).toContain('</Track>');
    expect(tcx).not.toContain('<Trackpoint>');
  });

  it('rounds HR values to integers', () => {
    const session = makeSession({
      samples: [{ timestamp: 0, hr: 72.7 }],
    });
    const tcx = sessionToTCX(session);
    expect(tcx).toContain('<Value>73</Value>');
  });
});
