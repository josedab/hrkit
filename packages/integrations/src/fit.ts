import type { Session, TimestampedHR } from '@hrkit/core';

/**
 * Garmin FIT (Flexible and Interoperable Data Transfer) binary encoder.
 *
 * Implements the minimum subset of the FIT 2.0 protocol required to produce a
 * valid Activity file accepted by Strava, Garmin Connect, TrainingPeaks, and
 * Intervals.icu.
 *
 * Messages emitted (in order):
 *   1. file_id       (global #0)
 *   2. file_creator  (global #49)
 *   3. event start   (global #21)
 *   4. record × N    (global #20)  — one per HR sample
 *   5. lap × R       (global #19)  — one per round (or one for whole session)
 *   6. event stop    (global #21)
 *   7. session       (global #18)
 *   8. activity      (global #34)
 *
 * @see https://developer.garmin.com/fit/protocol/
 */

export interface FitEncodeOptions {
  /** Sport string. Maps to FIT enum (1=running, 2=cycling, etc.). Default 0 (generic). */
  sport?: 'generic' | 'running' | 'cycling' | 'swimming' | 'training' | 'walking';
  /** Manufacturer ID. Default: 255 (development). */
  manufacturer?: number;
  /** Product ID. Default: 0. */
  product?: number;
}

const SPORT_MAP: Record<NonNullable<FitEncodeOptions['sport']>, number> = {
  generic: 0,
  running: 1,
  cycling: 2,
  swimming: 5,
  training: 10,
  walking: 11,
};

// FIT epoch is 1989-12-31T00:00:00Z (UTC).
const FIT_EPOCH_OFFSET = 631065600;

function toFitTimestamp(epochMs: number): number {
  return Math.max(0, Math.round(epochMs / 1000) - FIT_EPOCH_OFFSET);
}

/** Internal byte writer. */
class ByteWriter {
  private bytes: number[] = [];

  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  u16(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
  }

  u32(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }

  bytesArray(arr: number[]): void {
    for (const b of arr) this.u8(b);
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  get length(): number {
    return this.bytes.length;
  }
}

// FIT base type definitions: [size, baseType byte]
const T_ENUM = { size: 1, type: 0x00 };
const T_UINT8 = { size: 1, type: 0x02 };
const T_UINT16 = { size: 2, type: 0x84 };
const T_UINT32 = { size: 4, type: 0x86 };
const T_DATE = { size: 4, type: 0x86 };

interface FieldDef {
  num: number;
  size: number;
  baseType: number;
  /** value writer */
  write: (w: ByteWriter, v: number) => void;
}

function f(num: number, t: { size: number; type: number }, write: (w: ByteWriter, v: number) => void): FieldDef {
  return { num, size: t.size, baseType: t.type, write };
}

const writeU8 = (w: ByteWriter, v: number): void => w.u8(v);
const writeU16 = (w: ByteWriter, v: number): void => w.u16(v);
const writeU32 = (w: ByteWriter, v: number): void => w.u32(v);

// Definition + data message helpers
function writeDefinition(w: ByteWriter, localNum: number, globalNum: number, fields: FieldDef[]): void {
  w.u8(0x40 | (localNum & 0x0f)); // definition record header
  w.u8(0); // reserved
  w.u8(0); // architecture: little endian
  w.u16(globalNum);
  w.u8(fields.length);
  for (const fld of fields) {
    w.u8(fld.num);
    w.u8(fld.size);
    w.u8(fld.baseType);
  }
}

function writeData(w: ByteWriter, localNum: number, fields: FieldDef[], values: number[]): void {
  if (fields.length !== values.length) throw new Error('FIT: field/value length mismatch');
  w.u8(localNum & 0x0f); // data record header
  for (let i = 0; i < fields.length; i++) {
    fields[i]!.write(w, values[i]!);
  }
}

// CRC-16 (poly 0xA001) per FIT spec.
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01,
  0x8801, 0x4400,
];

function fitCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    let tmp = CRC_TABLE[crc & 0xf]!;
    crc = (crc >>> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[bytes[i]! & 0xf]!;
    tmp = CRC_TABLE[crc & 0xf]!;
    crc = (crc >>> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(bytes[i]! >>> 4) & 0xf]!;
  }
  return crc & 0xffff;
}

/**
 * Encode a Session as a FIT binary Activity file.
 *
 * @param session - Completed session.
 * @param options - Sport and manufacturer overrides.
 * @returns Uint8Array of the .fit file bytes (header + records + CRC).
 */
export function sessionToFIT(session: Session, options?: FitEncodeOptions): Uint8Array {
  const sport = SPORT_MAP[options?.sport ?? 'generic'];
  const manufacturer = options?.manufacturer ?? 255;
  const product = options?.product ?? 0;

  const records = new ByteWriter();

  // ── 1. file_id (global 0) ─────────────────────────────────────────
  const fileIdFields: FieldDef[] = [
    f(0, T_ENUM, writeU8), // type: 4 = activity
    f(1, T_UINT16, writeU16), // manufacturer
    f(2, T_UINT16, writeU16), // product
    f(4, T_DATE, writeU32), // time_created
  ];
  writeDefinition(records, 0, 0, fileIdFields);
  writeData(records, 0, fileIdFields, [4, manufacturer, product, toFitTimestamp(session.startTime)]);

  // ── 2. file_creator (global 49) ───────────────────────────────────
  const creatorFields: FieldDef[] = [
    f(0, T_UINT16, writeU16), // software_version
    f(1, T_UINT8, writeU8), // hardware_version
  ];
  writeDefinition(records, 1, 49, creatorFields);
  writeData(records, 1, creatorFields, [100, 1]); // 1.00, hw 1

  // ── 3. event start (global 21) ────────────────────────────────────
  const eventFields: FieldDef[] = [
    f(253, T_DATE, writeU32), // timestamp
    f(0, T_ENUM, writeU8), // event: 0=timer
    f(1, T_ENUM, writeU8), // event_type: 0=start, 4=stop_all
  ];
  writeDefinition(records, 2, 21, eventFields);
  writeData(records, 2, eventFields, [toFitTimestamp(session.startTime), 0, 0]);

  // ── 4. record (global 20) — HR samples ────────────────────────────
  const recordFields: FieldDef[] = [
    f(253, T_DATE, writeU32), // timestamp
    f(3, T_UINT8, writeU8), // heart_rate
  ];
  writeDefinition(records, 3, 20, recordFields);
  for (const s of session.samples) {
    writeData(records, 3, recordFields, [toFitTimestamp(s.timestamp), Math.max(0, Math.min(255, Math.round(s.hr)))]);
  }

  // ── 5. lap (global 19) ────────────────────────────────────────────
  const lapFields: FieldDef[] = [
    f(253, T_DATE, writeU32), // timestamp (end)
    f(2, T_DATE, writeU32), // start_time
    f(7, T_UINT32, writeU32), // total_elapsed_time (s × 1000)
    f(8, T_UINT32, writeU32), // total_timer_time (s × 1000)
    f(15, T_UINT8, writeU8), // avg_heart_rate
    f(16, T_UINT8, writeU8), // max_heart_rate
    f(0, T_ENUM, writeU8), // event: 9=lap
    f(1, T_ENUM, writeU8), // event_type: 1=stop
  ];
  writeDefinition(records, 4, 19, lapFields);

  const writeLap = (start: number, end: number, samples: TimestampedHR[]): void => {
    const elapsedMs = Math.max(0, end - start);
    const avg = avgHR(samples);
    const max = maxHR(samples);
    writeData(records, 4, lapFields, [
      toFitTimestamp(end),
      toFitTimestamp(start),
      Math.round(elapsedMs),
      Math.round(elapsedMs),
      avg,
      max,
      9,
      1,
    ]);
  };

  if (session.rounds.length > 0) {
    for (const r of session.rounds) writeLap(r.startTime, r.endTime, r.samples);
  } else {
    writeLap(session.startTime, session.endTime, session.samples);
  }

  // ── 6. event stop ─────────────────────────────────────────────────
  writeData(records, 2, eventFields, [toFitTimestamp(session.endTime), 0, 4]);

  // ── 7. session (global 18) ────────────────────────────────────────
  const sessionFields: FieldDef[] = [
    f(253, T_DATE, writeU32), // timestamp
    f(2, T_DATE, writeU32), // start_time
    f(7, T_UINT32, writeU32), // total_elapsed_time (ms)
    f(8, T_UINT32, writeU32), // total_timer_time (ms)
    f(5, T_ENUM, writeU8), // sport
    f(6, T_ENUM, writeU8), // sub_sport (0=generic)
    f(15, T_UINT8, writeU8), // avg_heart_rate
    f(16, T_UINT8, writeU8), // max_heart_rate
  ];
  writeDefinition(records, 5, 18, sessionFields);
  writeData(records, 5, sessionFields, [
    toFitTimestamp(session.endTime),
    toFitTimestamp(session.startTime),
    Math.max(0, session.endTime - session.startTime),
    Math.max(0, session.endTime - session.startTime),
    sport,
    0,
    avgHR(session.samples),
    maxHR(session.samples),
  ]);

  // ── 8. activity (global 34) ───────────────────────────────────────
  const activityFields: FieldDef[] = [
    f(253, T_DATE, writeU32), // timestamp
    f(5, T_DATE, writeU32), // local_timestamp (just reuse)
    f(0, T_UINT32, writeU32), // total_timer_time
    f(1, T_UINT16, writeU16), // num_sessions
    f(2, T_ENUM, writeU8), // type: 0=manual,1=auto_multi_sport
    f(3, T_ENUM, writeU8), // event
    f(4, T_ENUM, writeU8), // event_type
  ];
  writeDefinition(records, 6, 34, activityFields);
  writeData(records, 6, activityFields, [
    toFitTimestamp(session.endTime),
    toFitTimestamp(session.endTime),
    Math.max(0, session.endTime - session.startTime),
    1,
    0,
    26, // event=activity
    1, // event_type=stop
  ]);

  // ── Header (14 bytes) ─────────────────────────────────────────────
  const recordBytes = records.toUint8Array();
  const header = new ByteWriter();
  header.u8(14); // header size
  header.u8(0x10); // protocol version 1.0 (high nibble)
  header.u16(2140); // profile version 21.40
  header.u32(recordBytes.length); // data size
  header.bytesArray([0x2e, 0x46, 0x49, 0x54]); // ".FIT"
  const headerNoCrcLen = header.length;
  const headerNoCrc = header.toUint8Array().slice(0, headerNoCrcLen);
  const headerCrc = fitCrc(headerNoCrc);
  header.u16(headerCrc);

  // ── Concatenate ───────────────────────────────────────────────────
  const headerBytes = header.toUint8Array();
  const combined = new Uint8Array(headerBytes.length + recordBytes.length);
  combined.set(headerBytes, 0);
  combined.set(recordBytes, headerBytes.length);

  // file CRC over header + records
  const fileCrc = fitCrc(combined);
  const out = new Uint8Array(combined.length + 2);
  out.set(combined, 0);
  out[combined.length] = fileCrc & 0xff;
  out[combined.length + 1] = (fileCrc >>> 8) & 0xff;
  return out;
}

function avgHR(samples: TimestampedHR[]): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((acc, s) => acc + s.hr, 0);
  return Math.round(sum / samples.length);
}

function maxHR(samples: TimestampedHR[]): number {
  if (samples.length === 0) return 0;
  let m = 0;
  for (const s of samples) if (s.hr > m) m = s.hr;
  return Math.round(m);
}

/** Verify a FIT file's header magic + CRC trailer. Useful for tests and debugging. */
export function verifyFIT(bytes: Uint8Array): { ok: boolean; reason?: string } {
  if (bytes.length < 16) return { ok: false, reason: 'too short' };
  if (bytes[0] !== 14) return { ok: false, reason: 'bad header size' };
  const magic = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (magic !== '.FIT') return { ok: false, reason: `bad magic: ${magic}` };
  const dataSize = bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24);
  if (bytes.length !== 14 + dataSize + 2) {
    return { ok: false, reason: `length mismatch: ${bytes.length} vs ${14 + dataSize + 2}` };
  }
  // header CRC
  const headerCrc = fitCrc(bytes.slice(0, 12));
  const expectedHeaderCrc = bytes[12]! | (bytes[13]! << 8);
  if (headerCrc !== expectedHeaderCrc) return { ok: false, reason: 'bad header CRC' };
  // file CRC
  const fileCrc = fitCrc(bytes.slice(0, bytes.length - 2));
  const expectedFileCrc = bytes[bytes.length - 2]! | (bytes[bytes.length - 1]! << 8);
  if (fileCrc !== expectedFileCrc) return { ok: false, reason: 'bad file CRC' };
  return { ok: true };
}
