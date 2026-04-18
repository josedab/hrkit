import { SESSION_SCHEMA_VERSION, type Session } from '@hrkit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ReplayState, SessionPlayer } from '../session-replay.js';

function makeSession(sampleCount: number, intervalMs = 1000): Session {
  const start = 1700000000000;
  const samples = Array.from({ length: sampleCount }, (_, i) => ({
    timestamp: start + i * intervalMs,
    hr: 60 + (i % 40),
  }));
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    startTime: start,
    endTime: start + (sampleCount - 1) * intervalMs,
    samples,
    rrIntervals: samples.map((s) => 60000 / s.hr),
    rounds: [],
    config: { maxHR: 185, restHR: 55, sex: 'neutral' },
  };
}

describe('SessionPlayer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const player = new SessionPlayer(makeSession(10));
    expect(player.currentState).toBe('idle');
    expect(player.currentSampleIndex).toBe(0);
    player.dispose();
  });

  it('emits samples on play', () => {
    vi.useFakeTimers();
    const session = makeSession(5, 100);
    const player = new SessionPlayer(session);
    const events: number[] = [];
    player.sample$.subscribe((e) => events.push(e.index));

    player.play(8); // fast
    // First sample emitted synchronously
    expect(events).toContain(0);

    // Advance through all intervals
    vi.advanceTimersByTime(1000);
    expect(events.length).toBeGreaterThanOrEqual(3);
    player.dispose();
  });

  it('transitions to completed after all samples', () => {
    vi.useFakeTimers();
    const session = makeSession(3, 50);
    const player = new SessionPlayer(session);
    const states: ReplayState[] = [];
    player.state$.subscribe((s) => states.push(s));

    player.play(8);
    vi.advanceTimersByTime(1000);

    expect(states).toContain('playing');
    expect(states).toContain('completed');
    player.dispose();
  });

  it('pause and resume', () => {
    vi.useFakeTimers();
    const player = new SessionPlayer(makeSession(10, 100));
    const states: ReplayState[] = [];
    player.state$.subscribe((s) => states.push(s));

    player.play(1);
    expect(player.currentState).toBe('playing');

    player.pause();
    expect(player.currentState).toBe('paused');

    player.play(2);
    expect(player.currentState).toBe('playing');
    player.dispose();
  });

  it('stop resets to beginning', () => {
    vi.useFakeTimers();
    const player = new SessionPlayer(makeSession(10, 100));

    player.play(8);
    vi.advanceTimersByTime(500);
    expect(player.currentSampleIndex).toBeGreaterThan(0);

    player.stop();
    expect(player.currentState).toBe('idle');
    expect(player.currentSampleIndex).toBe(0);
    player.dispose();
  });

  it('seekToIndex updates position', () => {
    const player = new SessionPlayer(makeSession(10));
    const events: number[] = [];
    player.sample$.subscribe((e) => events.push(e.index));

    player.seekToIndex(5);
    expect(player.currentSampleIndex).toBe(5);
    expect(events).toContain(5);
    player.dispose();
  });

  it('seekToIndex clamps to valid range', () => {
    const player = new SessionPlayer(makeSession(10));
    player.seekToIndex(-5);
    expect(player.currentSampleIndex).toBe(0);
    player.seekToIndex(100);
    expect(player.currentSampleIndex).toBe(9);
    player.dispose();
  });

  it('seekToTime finds correct sample', () => {
    const session = makeSession(10, 1000);
    const player = new SessionPlayer(session);

    player.seekToTime(session.startTime + 5000);
    expect(player.currentSampleIndex).toBe(5);
    player.dispose();
  });

  it('setSpeed changes playback speed', () => {
    vi.useFakeTimers();
    const player = new SessionPlayer(makeSession(10, 100));

    player.play(1);
    player.setSpeed(4);

    const events: number[] = [];
    player.sample$.subscribe((e) => events.push(e.speed));
    vi.advanceTimersByTime(500);

    if (events.length > 0) {
      expect(events[events.length - 1]).toBe(4);
    }
    player.dispose();
  });

  it('play after completed restarts from beginning', () => {
    vi.useFakeTimers();
    const session = makeSession(3, 50);
    const player = new SessionPlayer(session);

    player.play(8);
    vi.advanceTimersByTime(1000);
    expect(player.currentState).toBe('completed');

    player.play(1);
    expect(player.currentState).toBe('playing');
    expect(player.currentSampleIndex).toBeGreaterThanOrEqual(0);
    player.dispose();
  });

  it('progress is 0–1 fraction', () => {
    const player = new SessionPlayer(makeSession(10));
    const events: number[] = [];
    player.sample$.subscribe((e) => events.push(e.progress));

    player.seekToIndex(0);
    player.seekToIndex(9);

    expect(events[0]).toBeCloseTo(0, 1);
    expect(events[1]).toBeCloseTo(1, 1);
    player.dispose();
  });

  it('pause is no-op when not playing', () => {
    const player = new SessionPlayer(makeSession(5));
    player.pause(); // should not throw
    expect(player.currentState).toBe('idle');
    player.dispose();
  });
});

describe('Annotations', () => {
  it('adds and retrieves annotations', () => {
    const session = makeSession(10, 1000);
    const player = new SessionPlayer(session);

    const ann = player.addAnnotation(session.startTime + 3000, 'Good form here', {
      type: 'highlight',
      author: 'Coach A',
    });
    expect(ann.id).toBeTruthy();
    expect(ann.text).toBe('Good form here');
    expect(ann.type).toBe('highlight');
    expect(ann.author).toBe('Coach A');
    expect(player.allAnnotations).toHaveLength(1);
    player.dispose();
  });

  it('sorts annotations by timestamp', () => {
    const session = makeSession(10, 1000);
    const player = new SessionPlayer(session);

    player.addAnnotation(session.startTime + 5000, 'Later');
    player.addAnnotation(session.startTime + 1000, 'Earlier');

    expect(player.allAnnotations[0]!.text).toBe('Earlier');
    expect(player.allAnnotations[1]!.text).toBe('Later');
    player.dispose();
  });

  it('removes annotation by ID', () => {
    const session = makeSession(10, 1000);
    const player = new SessionPlayer(session);

    const ann = player.addAnnotation(session.startTime, 'test');
    expect(player.removeAnnotation(ann.id)).toBe(true);
    expect(player.allAnnotations).toHaveLength(0);
    expect(player.removeAnnotation('nonexistent')).toBe(false);
    player.dispose();
  });

  it('filters annotations by time range', () => {
    const session = makeSession(10, 1000);
    const player = new SessionPlayer(session);

    player.addAnnotation(session.startTime + 1000, 'A');
    player.addAnnotation(session.startTime + 3000, 'B');
    player.addAnnotation(session.startTime + 7000, 'C');

    const range = player.getAnnotationsInRange(session.startTime + 2000, session.startTime + 8000);
    expect(range).toHaveLength(2);
    expect(range[0]!.text).toBe('B');
    expect(range[1]!.text).toBe('C');
    player.dispose();
  });

  it('defaults type to note', () => {
    const player = new SessionPlayer(makeSession(5));
    const ann = player.addAnnotation(0, 'default type');
    expect(ann.type).toBe('note');
    player.dispose();
  });
});
