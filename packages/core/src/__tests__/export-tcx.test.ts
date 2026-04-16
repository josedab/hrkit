import { describe, expect, it } from 'vitest';
import { sessionToTCX } from '../export-tcx.js';
import type { Session } from '../types.js';
import { SESSION_SCHEMA_VERSION } from '../types.js';

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

  it('includes calories element in output', () => {
    const tcx = sessionToTCX(makeSession());
    expect(tcx).toContain('<Calories>');
    expect(tcx).toContain('</Calories>');
    // avgHR = (72+120+150+165+140+110)/6 = 126.17
    // durationMin = 300/60 = 5
    // calories = 5 * (126.17 * 0.6309 - 30.4523) / 60 ≈ 4.09
    const match = tcx.match(/<Calories>(\d+)<\/Calories>/);
    expect(match).not.toBeNull();
    const cal = Number(match![1]);
    expect(cal).toBeGreaterThan(0);
  });

  it('includes RR intervals extension', () => {
    const session = makeSession({ rrIntervals: [812, 795, 750] });
    const tcx = sessionToTCX(session);

    expect(tcx).toContain('<Extensions>');
    expect(tcx).toContain('<TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">');
    expect(tcx).toContain('<RRIntervals>');
    expect(tcx).toContain('<RR>812</RR>');
    expect(tcx).toContain('<RR>795</RR>');
    expect(tcx).toContain('<RR>750</RR>');
  });

  it('creates multi-lap output with rounds', () => {
    const session = makeSession({
      rounds: [
        {
          index: 0,
          startTime: new Date('2024-06-15T10:00:00Z').getTime(),
          endTime: new Date('2024-06-15T10:02:00Z').getTime(),
          samples: [],
          rrIntervals: [812],
        },
        {
          index: 1,
          startTime: new Date('2024-06-15T10:03:00Z').getTime(),
          endTime: new Date('2024-06-15T10:05:00Z').getTime(),
          samples: [],
          rrIntervals: [795],
        },
      ],
    });
    const tcx = sessionToTCX(session);

    const lapCount = (tcx.match(/<Lap /g) ?? []).length;
    expect(lapCount).toBe(2);
    expect(tcx).toContain('<TotalTimeSeconds>120.0</TotalTimeSeconds>');
    // Each round's RR intervals appear in extensions
    expect(tcx).toContain('<RR>812</RR>');
    expect(tcx).toContain('<RR>795</RR>');
  });

  it('assigns correct samples to each round lap', () => {
    const session = makeSession({
      rounds: [
        {
          index: 0,
          startTime: new Date('2024-06-15T10:00:00Z').getTime(),
          endTime: new Date('2024-06-15T10:02:00Z').getTime(),
          samples: [],
          rrIntervals: [],
        },
        {
          index: 1,
          startTime: new Date('2024-06-15T10:03:00Z').getTime(),
          endTime: new Date('2024-06-15T10:05:00Z').getTime(),
          samples: [],
          rrIntervals: [],
        },
      ],
    });
    const tcx = sessionToTCX(session);

    // The first lap covers 10:00 - 10:02, should include 3 trackpoints (10:00, 10:01, 10:02)
    // The second lap covers 10:03 - 10:05, should include 3 trackpoints (10:03, 10:04, 10:05)
    const trackpointCount = (tcx.match(/<Trackpoint>/g) ?? []).length;
    expect(trackpointCount).toBe(6);
  });

  it('allows disabling RR intervals via option', () => {
    const session = makeSession({ rrIntervals: [812, 795] });
    const tcx = sessionToTCX(session, { includeRR: false });

    expect(tcx).not.toContain('<RRIntervals>');
    expect(tcx).not.toContain('<Extensions>');
  });

  it('allows disabling calories via option', () => {
    const tcx = sessionToTCX(makeSession(), { includeCalories: false });
    expect(tcx).not.toContain('<Calories>');
  });

  it('outputs 0 calories for empty session', () => {
    const tcx = sessionToTCX(makeSession({ samples: [] }));
    expect(tcx).toContain('<Calories>0</Calories>');
  });

  it('omits RR extension when rrIntervals is empty', () => {
    const tcx = sessionToTCX(makeSession({ rrIntervals: [] }));
    expect(tcx).not.toContain('<RRIntervals>');
    expect(tcx).not.toContain('<Extensions>');
  });
});
