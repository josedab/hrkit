import type { MockFixture } from '../../mock-transport.js';

/**
 * Simulated Polar H10 BJJ sparring session.
 * High intensity, variable HR, includes RR intervals.
 */
export const BJJ_SESSION_FIXTURE: MockFixture = {
  device: { id: 'h10-001', name: 'Polar H10 A1B2C3', rssi: -45 },
  packets: [
    { timestamp: 1000, hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 2000, hr: 78, rrIntervals: [769], contactDetected: true },
    { timestamp: 3000, hr: 95, rrIntervals: [631], contactDetected: true },
    { timestamp: 4000, hr: 110, rrIntervals: [545], contactDetected: true },
    { timestamp: 5000, hr: 128, rrIntervals: [469], contactDetected: true },
    { timestamp: 6000, hr: 145, rrIntervals: [414], contactDetected: true },
    { timestamp: 7000, hr: 158, rrIntervals: [380], contactDetected: true },
    { timestamp: 8000, hr: 165, rrIntervals: [364], contactDetected: true },
    { timestamp: 9000, hr: 172, rrIntervals: [349], contactDetected: true },
    { timestamp: 10000, hr: 178, rrIntervals: [337], contactDetected: true },
    { timestamp: 11000, hr: 175, rrIntervals: [343], contactDetected: true },
    { timestamp: 12000, hr: 168, rrIntervals: [357], contactDetected: true },
    { timestamp: 13000, hr: 155, rrIntervals: [387], contactDetected: true },
    { timestamp: 14000, hr: 140, rrIntervals: [429], contactDetected: true },
    { timestamp: 15000, hr: 125, rrIntervals: [480], contactDetected: true },
    { timestamp: 16000, hr: 112, rrIntervals: [536], contactDetected: true },
    { timestamp: 17000, hr: 105, rrIntervals: [571], contactDetected: true },
    { timestamp: 18000, hr: 130, rrIntervals: [462], contactDetected: true },
    { timestamp: 19000, hr: 150, rrIntervals: [400], contactDetected: true },
    { timestamp: 20000, hr: 168, rrIntervals: [357], contactDetected: true },
  ],
};

/**
 * Simulated H10 morning 5-minute rest reading.
 * Low HR, clean RR intervals for HRV analysis.
 */
export const REST_READING_FIXTURE: MockFixture = {
  device: { id: 'h10-002', name: 'Polar H10 D4E5F6', rssi: -40 },
  packets: [
    { timestamp: 1000, hr: 58, rrIntervals: [1034], contactDetected: true },
    { timestamp: 2000, hr: 56, rrIntervals: [1071], contactDetected: true },
    { timestamp: 3000, hr: 57, rrIntervals: [1053], contactDetected: true },
    { timestamp: 4000, hr: 55, rrIntervals: [1091], contactDetected: true },
    { timestamp: 5000, hr: 58, rrIntervals: [1034], contactDetected: true },
    { timestamp: 6000, hr: 56, rrIntervals: [1071], contactDetected: true },
    { timestamp: 7000, hr: 54, rrIntervals: [1111], contactDetected: true },
    { timestamp: 8000, hr: 57, rrIntervals: [1053], contactDetected: true },
    { timestamp: 9000, hr: 55, rrIntervals: [1091], contactDetected: true },
    { timestamp: 10000, hr: 56, rrIntervals: [1071], contactDetected: true },
  ],
};

/**
 * Generic HR strap cycling session.
 * HR only, no RR intervals (some cheap straps don't provide them).
 */
export const CYCLING_HR_ONLY_FIXTURE: MockFixture = {
  device: { id: 'generic-001', name: 'HR-Strap', rssi: -60 },
  packets: [
    { timestamp: 1000, hr: 85, rrIntervals: [], contactDetected: true },
    { timestamp: 2000, hr: 92, rrIntervals: [], contactDetected: true },
    { timestamp: 3000, hr: 105, rrIntervals: [], contactDetected: true },
    { timestamp: 4000, hr: 118, rrIntervals: [], contactDetected: true },
    { timestamp: 5000, hr: 125, rrIntervals: [], contactDetected: true },
    { timestamp: 6000, hr: 132, rrIntervals: [], contactDetected: true },
    { timestamp: 7000, hr: 128, rrIntervals: [], contactDetected: true },
    { timestamp: 8000, hr: 135, rrIntervals: [], contactDetected: true },
    { timestamp: 9000, hr: 140, rrIntervals: [], contactDetected: true },
    { timestamp: 10000, hr: 138, rrIntervals: [], contactDetected: true },
  ],
};

/**
 * RR intervals with synthetic artifacts injected for artifact filter testing.
 */
export const RR_WITH_ARTIFACTS: number[] = [
  800, 810, 790, 820, 805,       // clean
  1500,                            // artifact: missed beat
  800, 815, 795, 810,             // clean
  300,                             // artifact: extra beat
  805, 790, 820, 800, 810,       // clean
  1600,                            // artifact: missed beat
  795, 810, 805, 800,             // clean
];
