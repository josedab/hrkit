import { describe, expect, it, vi } from 'vitest';
import type { DataChannelLike, RoomPeer, SignalingMessage } from '../webrtc.js';
import { SignalingRoom, WebRTCBroadcaster } from '../webrtc.js';

function makePeer(
  peerId: string,
  role: 'broadcaster' | 'viewer' = 'viewer',
): RoomPeer & { received: SignalingMessage[] } {
  const received: SignalingMessage[] = [];
  return {
    peerId,
    role,
    received,
    send: (msg) => {
      received.push(msg);
    },
  };
}

describe('SignalingRoom', () => {
  it('notifies joiners of existing peers', () => {
    const room = new SignalingRoom();
    const a = makePeer('a', 'broadcaster');
    const b = makePeer('b');
    room.join('r1', a);
    room.join('r1', b);
    const joinerMsg = b.received[0];
    expect(joinerMsg?.type).toBe('peers');
    if (joinerMsg?.type === 'peers') {
      expect(joinerMsg.peers).toHaveLength(1);
      expect(joinerMsg.peers[0]).toEqual({ peerId: 'a', role: 'broadcaster' });
    }
  });

  it('routes offer/answer/ice to the targeted peer only', () => {
    const room = new SignalingRoom();
    const a = makePeer('a', 'broadcaster');
    const b = makePeer('b');
    const c = makePeer('c');
    room.join('r1', a);
    room.join('r1', b);
    room.join('r1', c);
    a.received.length = 0;
    b.received.length = 0;
    c.received.length = 0;

    const ok = room.route({ type: 'offer', roomId: 'r1', from: 'a', to: 'b', sdp: 'sdp-data' });
    expect(ok).toBe(true);
    expect(b.received).toHaveLength(1);
    expect(c.received).toHaveLength(0);
  });

  it('returns false when target peer is missing', () => {
    const room = new SignalingRoom();
    const a = makePeer('a');
    room.join('r1', a);
    const ok = room.route({ type: 'answer', roomId: 'r1', from: 'a', to: 'ghost', sdp: '' });
    expect(ok).toBe(false);
  });

  it('cleans up empty rooms on leave', () => {
    const room = new SignalingRoom();
    const a = makePeer('a');
    room.join('r1', a);
    expect(room.roomCount).toBe(1);
    room.leave('r1', 'a');
    expect(room.roomCount).toBe(0);
  });

  it('reports peers in a room', () => {
    const room = new SignalingRoom();
    room.join('r1', makePeer('a'));
    room.join('r1', makePeer('b'));
    expect(room.peers('r1')).toHaveLength(2);
  });
});

describe('WebRTCBroadcaster', () => {
  function makeChannel(state: DataChannelLike['readyState'] = 'open'): DataChannelLike & { sent: string[] } {
    return {
      readyState: state,
      sent: [] as string[],
      send(data: string) {
        this.sent.push(data);
      },
    };
  }

  it('only sends to open channels', () => {
    const bc = new WebRTCBroadcaster({ maxRateHz: 1000 });
    const open = makeChannel('open');
    const closed = makeChannel('closed');
    bc.addChannel(open);
    bc.addChannel(closed);
    bc.broadcastRaw({ timestamp: 1, hr: 100, rrIntervals: [] });
    expect(open.sent).toHaveLength(1);
    expect(closed.sent).toHaveLength(0);
  });

  it('rate-limits broadcasts', () => {
    const bc = new WebRTCBroadcaster({ maxRateHz: 10 });
    const ch = makeChannel('open');
    bc.addChannel(ch);
    for (let i = 0; i < 100; i++) {
      bc.broadcast({ timestamp: i, hr: 100, rrIntervals: [], sensorContact: null, energyExpended: null });
    }
    // First call always passes; subsequent throttled within 100ms window
    expect(ch.sent.length).toBeLessThan(5);
  });

  it('removes channel that throws on send', () => {
    const bc = new WebRTCBroadcaster({ maxRateHz: 1000 });
    const bad: DataChannelLike = {
      readyState: 'open',
      send() {
        throw new Error('boom');
      },
    };
    bc.addChannel(bad);
    bc.broadcastRaw({ timestamp: 1, hr: 100, rrIntervals: [] });
    expect(bc.openChannelCount).toBe(0);
  });

  it('counts open channels', () => {
    const bc = new WebRTCBroadcaster();
    bc.addChannel(makeChannel('open'));
    bc.addChannel(makeChannel('open'));
    bc.addChannel(makeChannel('closed'));
    expect(bc.openChannelCount).toBe(2);
  });
});

describe('signaling message types', () => {
  it('discriminates message types via `type` field', () => {
    const msg: SignalingMessage = { type: 'join', roomId: 'r', peerId: 'p', role: 'viewer' };
    expect(msg.type).toBe('join');
    // Compile-time check: vi mocks don't affect this
    const fn = vi.fn((m: SignalingMessage) => m.type);
    expect(fn(msg)).toBe('join');
  });
});
