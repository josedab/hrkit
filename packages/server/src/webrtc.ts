import type { HRPacket } from '@hrkit/core';
import type { BroadcastExtra, BroadcastPayload } from './index.js';
import { buildPayload } from './index.js';

/**
 * Signaling protocol message types exchanged between peers via the
 * server's signaling channel (e.g., over WebSocket).
 *
 * The server is purely a relay; it does not implement STUN/TURN.
 * Bring your own STUN/TURN servers for production use.
 */
export type SignalingMessage =
  | { type: 'join'; roomId: string; peerId: string; role: 'broadcaster' | 'viewer' }
  | { type: 'leave'; roomId: string; peerId: string }
  | { type: 'offer'; roomId: string; from: string; to: string; sdp: string }
  | { type: 'answer'; roomId: string; from: string; to: string; sdp: string }
  | { type: 'ice'; roomId: string; from: string; to: string; candidate: unknown }
  | { type: 'peers'; roomId: string; peers: { peerId: string; role: 'broadcaster' | 'viewer' }[] }
  | { type: 'error'; message: string };

/** A connected peer registered with the signaling room. */
export interface RoomPeer {
  peerId: string;
  role: 'broadcaster' | 'viewer';
  /** Send a serialized signaling message to this peer. */
  send: (msg: SignalingMessage) => void;
}

/**
 * In-memory signaling room registry. Routes signaling messages between
 * peers in the same room. Designed to be transport-agnostic — wire it up
 * to WebSocket, SSE, or any duplex channel.
 */
export class SignalingRoom {
  /** roomId → peerId → peer */
  private readonly rooms = new Map<string, Map<string, RoomPeer>>();

  /** Number of rooms with at least one peer. */
  get roomCount(): number {
    return this.rooms.size;
  }

  /** Get all peers in a room. */
  peers(roomId: string): RoomPeer[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? []);
  }

  /** Add a peer to a room. Notifies the new peer of existing peers. */
  join(roomId: string, peer: RoomPeer): void {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    room.set(peer.peerId, peer);

    // Send the joiner the current peer list (so it can initiate offers)
    peer.send({
      type: 'peers',
      roomId,
      peers: Array.from(room.values())
        .filter((p) => p.peerId !== peer.peerId)
        .map((p) => ({ peerId: p.peerId, role: p.role })),
    });
  }

  /** Remove a peer from a room. Cleans up empty rooms. */
  leave(roomId: string, peerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.delete(peerId);
    if (room.size === 0) this.rooms.delete(roomId);
  }

  /**
   * Route a signaling message. Returns true if delivered (or broadcast attempted),
   * false if the target is unknown.
   */
  route(msg: SignalingMessage): boolean {
    if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice') {
      const room = this.rooms.get(msg.roomId);
      const target = room?.get(msg.to);
      if (!target) return false;
      target.send(msg);
      return true;
    }
    return false;
  }
}

/**
 * Helper to broadcast HR data over an existing WebRTC DataChannel.
 * The application owns the RTCPeerConnection lifecycle; this just throttles
 * and serializes packets in a uniform format.
 */
export interface DataChannelLike {
  readonly readyState: 'connecting' | 'open' | 'closing' | 'closed';
  send(data: string): void;
}

/** Broadcast HR packets over a set of WebRTC data channels with rate limiting. */
export class WebRTCBroadcaster {
  private channels = new Set<DataChannelLike>();
  private lastBroadcastTime = 0;
  private readonly maxRateHz: number;

  constructor(opts: { maxRateHz?: number } = {}) {
    this.maxRateHz = opts.maxRateHz ?? 10;
  }

  /** Register a data channel to receive broadcasts. */
  addChannel(ch: DataChannelLike): void {
    this.channels.add(ch);
  }

  /** Stop broadcasting to a channel. */
  removeChannel(ch: DataChannelLike): void {
    this.channels.delete(ch);
  }

  /** Active channel count (in 'open' state). */
  get openChannelCount(): number {
    let n = 0;
    for (const ch of this.channels) if (ch.readyState === 'open') n++;
    return n;
  }

  /** Broadcast an HR packet, respecting rate limit. */
  broadcast(packet: HRPacket, extra?: BroadcastExtra): void {
    const now = Date.now();
    const minInterval = 1000 / this.maxRateHz;
    if (now - this.lastBroadcastTime < minInterval) return;
    this.broadcastRaw(buildPayload(packet, extra));
  }

  /** Broadcast a pre-built payload (no rate limit). */
  broadcastRaw(payload: BroadcastPayload): void {
    const json = JSON.stringify(payload);
    this.lastBroadcastTime = Date.now();
    for (const ch of this.channels) {
      if (ch.readyState === 'open') {
        try {
          ch.send(json);
        } catch {
          // remove dead channels lazily
          this.channels.delete(ch);
        }
      }
    }
  }
}
