import type { Session } from '@hrkit/core';

/**
 * Cross-platform health-store bridge.
 *
 * Apple HealthKit (iOS) and Android Health Connect both expose write APIs for
 * heart-rate and workout records, but the runtime libraries differ wildly. To
 * keep `@hrkit/integrations` Node/Worker-portable we describe the *records*
 * here as plain data and let a thin platform adapter (RN, Capacitor) commit
 * them. Adapters implement {@link HealthStore} and call {@link sessionToHealthRecords}.
 */

export interface HrSampleRecord {
  type: 'heartRate';
  startMs: number;
  endMs: number;
  /** Beats per minute. */
  bpm: number;
}

export interface WorkoutRecord {
  type: 'workout';
  startMs: number;
  endMs: number;
  /** ICU MET equivalent, optional. */
  totalEnergyKcal?: number;
  /** Identifier matching HealthKit's HKWorkoutActivityType / Health Connect's ExerciseType. */
  activityType: 'running' | 'cycling' | 'strength' | 'martialArts' | 'other';
  metadata?: Record<string, string>;
}

export type HealthRecord = HrSampleRecord | WorkoutRecord;

export interface HealthStore {
  /** Request whatever permissions the platform requires. */
  requestAuthorization(types: HealthRecord['type'][]): Promise<{ granted: boolean }>;
  /** Persist a batch of records. Returns # of records written. */
  save(records: HealthRecord[]): Promise<{ saved: number }>;
}

export interface SessionToRecordsOptions {
  activityType?: WorkoutRecord['activityType'];
  /** Include per-sample HR records (iOS rejects > ~10/sec; downsample if needed). */
  includeHrSamples?: boolean;
}

export function sessionToHealthRecords(session: Session, opts: SessionToRecordsOptions = {}): HealthRecord[] {
  const records: HealthRecord[] = [];
  const startMs = session.startTime ?? session.samples[0]?.timestamp ?? Date.now();
  const endMs = startMs + (session.duration ?? 0);

  records.push({
    type: 'workout',
    startMs,
    endMs,
    activityType: opts.activityType ?? 'other',
    metadata: { source: '@hrkit' },
  });

  if (opts.includeHrSamples !== false) {
    for (let i = 0; i < session.samples.length; i++) {
      const s = session.samples[i]!;
      const next = session.samples[i + 1];
      records.push({
        type: 'heartRate',
        startMs: s.timestamp,
        endMs: next ? next.timestamp : s.timestamp + 1000,
        bpm: Math.round(s.hr),
      });
    }
  }
  return records;
}

/**
 * In-memory HealthStore for tests and dry runs. Real platform adapters live
 * in `@hrkit/react-native` (HealthKit) and `@hrkit/capacitor-native` (Health
 * Connect) once those PRs land.
 */
export class MemoryHealthStore implements HealthStore {
  readonly records: HealthRecord[] = [];
  private granted = false;

  async requestAuthorization(): Promise<{ granted: boolean }> {
    this.granted = true;
    return { granted: true };
  }

  async save(records: HealthRecord[]): Promise<{ saved: number }> {
    if (!this.granted) throw new Error('not authorized');
    this.records.push(...records);
    return { saved: records.length };
  }
}
