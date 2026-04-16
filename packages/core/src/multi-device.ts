import { HRKitError } from './errors.js';
import { SimpleStream } from './stream.js';
import type { HRConnection, HRPacket, ReadableStream } from './types.js';

// ── Public Types ────────────────────────────────────────────────────────

/** Quality metrics for a device's signal. */
export interface DeviceQuality {
  /** Device identifier. */
  deviceId: string;
  /** Device name. */
  deviceName: string;
  /** Number of packets received. */
  packetCount: number;
  /** Number of dropped/missing packets (gaps > 2s). */
  dropCount: number;
  /** Artifact rate for RR intervals (0-1). */
  artifactRate: number;
  /** Average time between packets in ms. */
  avgIntervalMs: number;
  /** Signal quality score (0-1, higher is better). */
  qualityScore: number;
  /** Last packet timestamp. */
  lastPacketTime: number;
}

/** Strategy for fusing HR data from multiple devices. */
export type FusionStrategyType = 'primary-fallback' | 'consensus' | 'best-rr';

/** Configuration for multi-device fusion. */
export interface MultiDeviceConfig {
  /** Fusion strategy. Default: 'primary-fallback'. */
  strategy: FusionStrategyType;
  /** Device ID to use as primary (for primary-fallback strategy). First connected if not set. */
  primaryDeviceId?: string;
  /** Maximum age of a packet before it's considered stale (ms). Default: 3000. */
  staleThresholdMs?: number;
}

/** A fused HR packet with source attribution. */
export interface FusedHRPacket extends HRPacket {
  /** Which device(s) contributed to this fused packet. */
  sourceDeviceIds: string[];
  /** The fusion strategy that produced this packet. */
  fusionStrategy: FusionStrategyType;
}

// ── Internal State ──────────────────────────────────────────────────────

interface DeviceState {
  connection: HRConnection;
  packets: HRPacket[];
  lastPacketTime: number;
  packetCount: number;
  dropCount: number;
  rrIntervals: number[];
  stopped: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────

const DEFAULT_STALE_THRESHOLD_MS = 3000;
const MAX_PACKET_BUFFER = 30;
const MAX_RR_BUFFER = 60;
const DROP_GAP_MS = 2000;
const ARTIFACT_DEVIATION = 0.2;

// ── Pure Fusion Functions ───────────────────────────────────────────────

function getLastPacket(state: DeviceState): HRPacket | undefined {
  return state.packets[state.packets.length - 1];
}

function isStale(state: DeviceState, staleMs: number, now: number): boolean {
  return now - state.lastPacketTime > staleMs;
}

function computeArtifactRate(rrIntervals: number[]): number {
  if (rrIntervals.length < 3) return 0;

  let artifacts = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const prev = rrIntervals[i - 1]!;
    const curr = rrIntervals[i]!;
    if (prev > 0 && Math.abs(curr - prev) / prev > ARTIFACT_DEVIATION) {
      artifacts++;
    }
  }
  return artifacts / (rrIntervals.length - 1);
}

function computeQualityScore(state: DeviceState, staleMs: number, now: number): number {
  if (state.packetCount === 0) return 0;

  const artifactRate = computeArtifactRate(state.rrIntervals);
  const dropRate = state.dropCount / state.packetCount;
  const age = now - state.lastPacketTime;
  const freshness = age < 1000 ? 1 : Math.max(0, 1 - (age - 1000) / (staleMs - 1000));

  return (1 - artifactRate) * (1 - dropRate) * freshness;
}

/**
 * Primary-Fallback: Use primary device. If primary is stale, fall back to
 * the device with the most recent packet.
 */
function fusePrimaryFallback(
  states: Map<string, DeviceState>,
  primaryId: string | undefined,
  staleMs: number,
  timestamp: number,
): FusedHRPacket | null {
  if (states.size === 0) return null;

  // Resolve primary: explicit, or first device
  let primary: DeviceState | undefined;
  if (primaryId && states.has(primaryId)) {
    primary = states.get(primaryId)!;
  } else {
    primary = states.values().next().value as DeviceState | undefined;
  }

  // Use primary if not stale
  if (primary && !isStale(primary, staleMs, timestamp)) {
    const pkt = getLastPacket(primary);
    if (pkt) {
      return {
        ...pkt,
        sourceDeviceIds: [primary.connection.deviceId],
        fusionStrategy: 'primary-fallback',
      };
    }
  }

  // Fallback: most recent packet across all devices
  let best: DeviceState | undefined;
  for (const state of states.values()) {
    if (!best || state.lastPacketTime > best.lastPacketTime) {
      best = state;
    }
  }

  if (best) {
    const pkt = getLastPacket(best);
    if (pkt) {
      return {
        ...pkt,
        sourceDeviceIds: [best.connection.deviceId],
        fusionStrategy: 'primary-fallback',
      };
    }
  }

  return null;
}

/**
 * Consensus: Use the median HR across all non-stale devices.
 * RR intervals come from the device with the lowest artifact rate.
 */
function fuseConsensus(states: Map<string, DeviceState>, staleMs: number, timestamp: number): FusedHRPacket | null {
  const fresh: DeviceState[] = [];
  for (const state of states.values()) {
    if (!isStale(state, staleMs, timestamp) && getLastPacket(state)) {
      fresh.push(state);
    }
  }

  if (fresh.length === 0) return null;

  // Median HR
  const hrs = fresh.map((s) => getLastPacket(s)!.hr).sort((a, b) => a - b);
  const mid = Math.floor(hrs.length / 2);
  const medianHR = hrs.length % 2 === 1 ? hrs[mid]! : Math.round((hrs[mid - 1]! + hrs[mid]!) / 2);

  // Best RR source: lowest artifact rate
  let bestRRState = fresh[0]!;
  let lowestArtifact = computeArtifactRate(bestRRState.rrIntervals);
  for (let i = 1; i < fresh.length; i++) {
    const rate = computeArtifactRate(fresh[i]!.rrIntervals);
    if (rate < lowestArtifact) {
      lowestArtifact = rate;
      bestRRState = fresh[i]!;
    }
  }

  const bestRRPacket = getLastPacket(bestRRState)!;
  const sourceIds = fresh.map((s) => s.connection.deviceId);

  return {
    timestamp,
    hr: medianHR,
    rrIntervals: bestRRPacket.rrIntervals,
    contactDetected: fresh.every((s) => getLastPacket(s)!.contactDetected),
    sourceDeviceIds: sourceIds,
    fusionStrategy: 'consensus',
  };
}

/**
 * Best-RR: Use the device with the lowest artifact rate for RR intervals
 * and its HR value. Falls back to device with most recent packet if no RR data.
 */
function fuseBestRR(states: Map<string, DeviceState>, staleMs: number, timestamp: number): FusedHRPacket | null {
  const fresh: DeviceState[] = [];
  for (const state of states.values()) {
    if (!isStale(state, staleMs, timestamp) && getLastPacket(state)) {
      fresh.push(state);
    }
  }

  if (fresh.length === 0) return null;

  // Find device with RR data and lowest artifact rate
  let bestState: DeviceState | undefined;
  let lowestRate = Infinity;

  for (const state of fresh) {
    if (state.rrIntervals.length > 0) {
      const rate = computeArtifactRate(state.rrIntervals);
      if (rate < lowestRate) {
        lowestRate = rate;
        bestState = state;
      }
    }
  }

  // Fallback: most recent packet
  if (!bestState) {
    bestState = fresh[0]!;
    for (const state of fresh) {
      if (state.lastPacketTime > bestState.lastPacketTime) {
        bestState = state;
      }
    }
  }

  const pkt = getLastPacket(bestState)!;
  return {
    ...pkt,
    sourceDeviceIds: [bestState.connection.deviceId],
    fusionStrategy: 'best-rr',
  };
}

// ── MultiDeviceManager ──────────────────────────────────────────────────

/**
 * Manages multiple BLE HR connections and fuses their data into a single stream.
 */
export class MultiDeviceManager {
  private config: Required<MultiDeviceConfig>;
  private connections = new Map<string, HRConnection>();
  private deviceStates = new Map<string, DeviceState>();
  private fusedStream = new SimpleStream<FusedHRPacket>();
  private qualityStream = new SimpleStream<DeviceQuality[]>();
  private running = true;

  /** Observable stream of fused HR packets. */
  readonly fused$: ReadableStream<FusedHRPacket> = this.fusedStream;
  /** Observable stream of per-device quality metrics. */
  readonly quality$: ReadableStream<DeviceQuality[]> = this.qualityStream;

  constructor(config?: Partial<MultiDeviceConfig>) {
    this.config = {
      strategy: config?.strategy ?? 'primary-fallback',
      primaryDeviceId: config?.primaryDeviceId ?? '',
      staleThresholdMs: config?.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS,
    };
  }

  /**
   * Add a connection to the fusion pool. Starts consuming its HR stream.
   * Auto-removes the connection on disconnect.
   *
   * @param connection - An active HR device connection.
   * @throws {HRKitError} if the manager is stopped or the device is already connected.
   */
  addConnection(connection: HRConnection): void {
    if (!this.running) {
      throw new HRKitError('MultiDeviceManager is stopped');
    }

    if (this.connections.has(connection.deviceId)) {
      throw new HRKitError(`Device "${connection.deviceId}" is already connected`);
    }

    this.connections.set(connection.deviceId, connection);

    const state: DeviceState = {
      connection,
      packets: [],
      lastPacketTime: 0,
      packetCount: 0,
      dropCount: 0,
      rrIntervals: [],
      stopped: false,
    };

    this.deviceStates.set(connection.deviceId, state);

    // Auto-remove on disconnect
    connection.onDisconnect.then(() => {
      this.removeConnection(connection.deviceId);
    });

    // Consume heart rate stream (fire-and-forget)
    this.consumeHeartRate(connection.deviceId, state);
  }

  private async consumeHeartRate(deviceId: string, state: DeviceState): Promise<void> {
    try {
      for await (const packet of state.connection.heartRate()) {
        if (state.stopped || !this.running) break;

        // Detect drops (gap > 2s between consecutive packets)
        if (state.packetCount > 0 && state.lastPacketTime > 0) {
          const gap = packet.timestamp - state.lastPacketTime;
          if (gap > DROP_GAP_MS) {
            state.dropCount++;
          }
        }

        // Update state
        state.packetCount++;
        state.lastPacketTime = packet.timestamp;
        state.packets.push(packet);
        if (state.packets.length > MAX_PACKET_BUFFER) {
          state.packets.shift();
        }

        // Track RR intervals
        for (const rr of packet.rrIntervals) {
          state.rrIntervals.push(rr);
          if (state.rrIntervals.length > MAX_RR_BUFFER) {
            state.rrIntervals.shift();
          }
        }

        // Fuse and emit
        const fused = this.fuse(packet.timestamp);
        if (fused) {
          this.fusedStream.emit(fused);
        }

        // Emit quality update
        this.qualityStream.emit(this.getQuality());
      }
    } catch {
      // Connection failed — remove device
      this.removeConnection(deviceId);
    }
  }

  private fuse(timestamp: number): FusedHRPacket | null {
    const staleMs = this.config.staleThresholdMs;

    switch (this.config.strategy) {
      case 'primary-fallback':
        return fusePrimaryFallback(this.deviceStates, this.config.primaryDeviceId || undefined, staleMs, timestamp);
      case 'consensus':
        return fuseConsensus(this.deviceStates, staleMs, timestamp);
      case 'best-rr':
        return fuseBestRR(this.deviceStates, staleMs, timestamp);
      default:
        return null;
    }
  }

  /**
   * Remove a connection from the fusion pool.
   *
   * @param deviceId - Identifier of the device to remove.
   */
  removeConnection(deviceId: string): void {
    const state = this.deviceStates.get(deviceId);
    if (state) {
      state.stopped = true;
    }
    this.deviceStates.delete(deviceId);
    this.connections.delete(deviceId);
  }

  /**
   * Get quality metrics for all connected devices.
   *
   * @returns Array of {@link DeviceQuality} for each active device.
   */
  getQuality(): DeviceQuality[] {
    const now = Date.now();
    const result: DeviceQuality[] = [];

    for (const state of this.deviceStates.values()) {
      result.push(this.buildQuality(state, now));
    }

    return result;
  }

  /**
   * Get quality metrics for a specific device.
   *
   * @param deviceId - Identifier of the device.
   * @returns {@link DeviceQuality} for the device, or `undefined` if not found.
   */
  getDeviceQuality(deviceId: string): DeviceQuality | undefined {
    const state = this.deviceStates.get(deviceId);
    if (!state) return undefined;
    return this.buildQuality(state, Date.now());
  }

  private buildQuality(state: DeviceState, now: number): DeviceQuality {
    const artifactRate = computeArtifactRate(state.rrIntervals);

    let avgIntervalMs = 0;
    if (state.packets.length >= 2) {
      const first = state.packets[0]!;
      const last = state.packets[state.packets.length - 1]!;
      avgIntervalMs = (last.timestamp - first.timestamp) / (state.packets.length - 1);
    }

    return {
      deviceId: state.connection.deviceId,
      deviceName: state.connection.deviceName,
      packetCount: state.packetCount,
      dropCount: state.dropCount,
      artifactRate,
      avgIntervalMs,
      qualityScore: computeQualityScore(state, this.config.staleThresholdMs, now),
      lastPacketTime: state.lastPacketTime,
    };
  }

  /** Get the number of active connections. */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Stop all streams and disconnect all devices.
   *
   * @returns A promise that resolves when all devices have been disconnected.
   */
  async stop(): Promise<void> {
    this.running = false;

    // Stop all consumption loops
    for (const state of this.deviceStates.values()) {
      state.stopped = true;
    }

    // Disconnect all
    const disconnects: Promise<void>[] = [];
    for (const conn of this.connections.values()) {
      disconnects.push(conn.disconnect());
    }

    await Promise.all(disconnects);

    this.deviceStates.clear();
    this.connections.clear();
  }
}
