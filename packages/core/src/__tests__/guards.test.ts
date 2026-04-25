import { describe, expect, it } from 'vitest';
import { isHRDevice, isHRPacket, isSession } from '../guards.js';

describe('isHRPacket', () => {
  it('returns true for a valid HRPacket', () => {
    expect(isHRPacket({ timestamp: 0, hr: 72, rrIntervals: [833], contactDetected: true })).toBe(true);
  });

  it('returns true with optional energyExpended', () => {
    expect(isHRPacket({ timestamp: 0, hr: 72, rrIntervals: [], contactDetected: true, energyExpended: 150 })).toBe(
      true,
    );
  });

  it('returns false for null', () => {
    expect(isHRPacket(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isHRPacket(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isHRPacket('not a packet')).toBe(false);
  });

  it('returns false when hr is missing', () => {
    expect(isHRPacket({ timestamp: 0, rrIntervals: [], contactDetected: true })).toBe(false);
  });

  it('returns false when rrIntervals is not an array', () => {
    expect(isHRPacket({ timestamp: 0, hr: 72, rrIntervals: 'nope', contactDetected: true })).toBe(false);
  });

  it('returns false when contactDetected is not boolean', () => {
    expect(isHRPacket({ timestamp: 0, hr: 72, rrIntervals: [], contactDetected: 1 })).toBe(false);
  });
});

describe('isHRDevice', () => {
  it('returns true for a valid HRDevice', () => {
    expect(isHRDevice({ id: 'abc', name: 'Polar H10', rssi: -60 })).toBe(true);
  });

  it('returns true with optional profile', () => {
    expect(
      isHRDevice({
        id: 'abc',
        name: 'Polar H10',
        rssi: -60,
        profile: { brand: 'Polar', model: 'H10', namePrefix: 'Polar', capabilities: ['heartRate'], serviceUUIDs: [] },
      }),
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isHRDevice(null)).toBe(false);
  });

  it('returns false when id is missing', () => {
    expect(isHRDevice({ name: 'Polar H10', rssi: -60 })).toBe(false);
  });

  it('returns false when rssi is not a number', () => {
    expect(isHRDevice({ id: 'abc', name: 'Polar H10', rssi: 'strong' })).toBe(false);
  });
});

describe('isSession', () => {
  const validSession = {
    schemaVersion: 3,
    startTime: 1000,
    endTime: 2000,
    samples: [{ timestamp: 1000, hr: 72 }],
    rrIntervals: [833],
    rounds: [],
    config: { maxHR: 185, restHR: 48 },
  };

  it('returns true for a valid Session', () => {
    expect(isSession(validSession)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSession(null)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isSession(42)).toBe(false);
  });

  it('returns false when config is null', () => {
    expect(isSession({ ...validSession, config: null })).toBe(false);
  });

  it('returns false when samples is not an array', () => {
    expect(isSession({ ...validSession, samples: 'nope' })).toBe(false);
  });

  it('returns false when schemaVersion is missing', () => {
    const { schemaVersion: _, ...rest } = validSession;
    expect(isSession(rest)).toBe(false);
  });

  it('returns false when endTime is not a number', () => {
    expect(isSession({ ...validSession, endTime: '2000' })).toBe(false);
  });
});
