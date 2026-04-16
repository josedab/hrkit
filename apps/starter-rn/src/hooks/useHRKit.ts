import type { HRPacket, SessionAnalysis, SessionConfig } from '@hrkit/core';
import { analyzeSession, SessionRecorder } from '@hrkit/core';
import { useCallback, useRef, useState } from 'react';

export interface UseHRKitOptions {
  config: SessionConfig;
}

export interface UseHRKitReturn {
  /** Current heart rate in BPM (0 when not recording) */
  hr: number;
  /** Current heart rate zone 1–5 (0 when not recording) */
  zone: number;
  /** Whether a session is currently being recorded */
  isRecording: boolean;
  /** Whether the session is paused */
  isPaused: boolean;
  /** Elapsed session time in seconds */
  elapsed: number;
  /** Begin a new recording session */
  startSession: () => void;
  /** End the session and return analysis results */
  stopSession: () => SessionAnalysis | null;
  /** Pause the current session (packets are ignored while paused) */
  pauseSession: () => void;
  /** Resume a paused session */
  resumeSession: () => void;
  /** Feed a BLE heart rate packet into the recorder */
  ingestPacket: (packet: HRPacket) => void;
  /** Mark the start of a round (e.g., sparring round, interval) */
  startRound: (label?: string) => void;
  /** Mark the end of the current round */
  endRound: () => void;
}

/**
 * React hook wrapping @hrkit/core's SessionRecorder for idiomatic React usage.
 *
 * @example
 * ```tsx
 * const { hr, zone, startSession, stopSession, ingestPacket } = useHRKit({
 *   config: { maxHR: 185, restHR: 50, sex: 'male' },
 * });
 *
 * // Start recording
 * startSession();
 *
 * // Feed packets from BLE connection
 * ingestPacket(packet);
 *
 * // End session and get analysis
 * const analysis = stopSession();
 * console.log(analysis?.trimp, analysis?.hrv?.rmssd);
 * ```
 */
export function useHRKit(options: UseHRKitOptions): UseHRKitReturn {
  const recorderRef = useRef<SessionRecorder | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const [hr, setHR] = useState(0);
  const [zone, setZone] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startSession = useCallback(() => {
    // Clean up any previous session
    unsubsRef.current.forEach((unsub) => {
      unsub();
    });
    unsubsRef.current = [];

    const recorder = new SessionRecorder(options.config);
    const unsubHR = recorder.hr$.subscribe((value) => setHR(value));
    const unsubZone = recorder.zone$.subscribe((value) => setZone(value));
    unsubsRef.current = [unsubHR, unsubZone];

    recorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);
    setElapsed(0);
  }, [options.config]);

  const stopSession = useCallback((): SessionAnalysis | null => {
    if (!recorderRef.current) return null;

    const session = recorderRef.current.end();
    const analysis = analyzeSession(session);

    // Clean up subscriptions
    unsubsRef.current.forEach((unsub) => {
      unsub();
    });
    unsubsRef.current = [];
    recorderRef.current = null;

    setIsRecording(false);
    setIsPaused(false);
    setHR(0);
    setZone(0);

    return analysis;
  }, []);

  const pauseSession = useCallback(() => {
    recorderRef.current?.pause();
    setIsPaused(true);
  }, []);

  const resumeSession = useCallback(() => {
    recorderRef.current?.resume();
    setIsPaused(false);
  }, []);

  const ingestPacket = useCallback((packet: HRPacket) => {
    recorderRef.current?.ingest(packet);
    setElapsed(recorderRef.current?.elapsedSeconds() ?? 0);
  }, []);

  const startRound = useCallback((label?: string) => {
    recorderRef.current?.startRound(label ? { label } : undefined);
  }, []);

  const endRound = useCallback(() => {
    recorderRef.current?.endRound();
  }, []);

  return {
    hr,
    zone,
    isRecording,
    isPaused,
    elapsed,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    ingestPacket,
    startRound,
    endRound,
  };
}
