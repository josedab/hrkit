import { describe, expect, it, vi } from 'vitest';
import { HRKitError } from '../errors.js';
import type { HRKitPlugin } from '../plugin.js';
import { PluginRegistry } from '../plugin.js';
import type { HRPacket, Round, Session } from '../types.js';

function makePacket(overrides: Partial<HRPacket> = {}): HRPacket {
  return {
    timestamp: 1000,
    hr: 120,
    rrIntervals: [500],
    contactDetected: true,
    ...overrides,
  };
}

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    index: 0,
    startTime: 0,
    endTime: 60_000,
    samples: [],
    rrIntervals: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    schemaVersion: 1,
    startTime: 0,
    endTime: 60_000,
    samples: [],
    rrIntervals: [],
    rounds: [],
    config: { maxHR: 190 },
    ...overrides,
  };
}

function makePlugin(overrides: Partial<HRKitPlugin> & { name: string }): HRKitPlugin {
  return { version: '1.0.0', ...overrides };
}

describe('PluginRegistry', () => {
  // ── Register / Unregister ────────────────────────────────────────────

  it('registers and retrieves a plugin', () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin({ name: 'test-plugin' });
    registry.register(plugin);

    expect(registry.has('test-plugin')).toBe(true);
    expect(registry.get('test-plugin')).toBe(plugin);
  });

  it('throws HRKitError on duplicate plugin name', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin({ name: 'dup' }));

    expect(() => registry.register(makePlugin({ name: 'dup' }))).toThrow(HRKitError);
    expect(() => registry.register(makePlugin({ name: 'dup' }))).toThrow('Plugin "dup" is already registered');
  });

  it('unregisters a plugin by name', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin({ name: 'removable' }));
    registry.unregister('removable');

    expect(registry.has('removable')).toBe(false);
    expect(registry.get('removable')).toBeUndefined();
  });

  it('unregistering a non-existent plugin is a no-op', () => {
    const registry = new PluginRegistry();
    expect(() => registry.unregister('ghost')).not.toThrow();
  });

  // ── onInit / onDestroy ───────────────────────────────────────────────

  it('calls onInit when a plugin is registered', () => {
    const registry = new PluginRegistry();
    const onInit = vi.fn();
    registry.register(makePlugin({ name: 'init-test', onInit }));

    expect(onInit).toHaveBeenCalledOnce();
  });

  it('calls onDestroy when a plugin is unregistered', () => {
    const registry = new PluginRegistry();
    const onDestroy = vi.fn();
    registry.register(makePlugin({ name: 'destroy-test', onDestroy }));
    registry.unregister('destroy-test');

    expect(onDestroy).toHaveBeenCalledOnce();
  });

  // ── get / getAll / has ───────────────────────────────────────────────

  it('get returns undefined for unknown plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.get('nope')).toBeUndefined();
  });

  it('has returns false for unknown plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.has('nope')).toBe(false);
  });

  it('getAll returns plugins in registration order', () => {
    const registry = new PluginRegistry();
    const a = makePlugin({ name: 'alpha' });
    const b = makePlugin({ name: 'bravo' });
    const c = makePlugin({ name: 'charlie' });
    registry.register(a);
    registry.register(b);
    registry.register(c);

    const all = registry.getAll();
    expect(all).toEqual([a, b, c]);
  });

  it('getAll returns empty array when no plugins registered', () => {
    const registry = new PluginRegistry();
    expect(registry.getAll()).toEqual([]);
  });

  // ── processPacket ────────────────────────────────────────────────────

  it('processPacket returns original packet when no plugins transform', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin({ name: 'noop' }));

    const packet = makePacket();
    expect(registry.processPacket(packet)).toBe(packet);
  });

  it('processPacket returns original packet when onPacket returns void', () => {
    const registry = new PluginRegistry();
    registry.register(
      makePlugin({
        name: 'void-return',
        onPacket: () => undefined,
      }),
    );

    const packet = makePacket();
    expect(registry.processPacket(packet)).toBe(packet);
  });

  it('processPacket chains transformations across plugins', () => {
    const registry = new PluginRegistry();

    registry.register(
      makePlugin({
        name: 'double-hr',
        onPacket: (p) => ({ ...p, hr: p.hr * 2 }),
      }),
    );
    registry.register(
      makePlugin({
        name: 'add-ten',
        onPacket: (p) => ({ ...p, hr: p.hr + 10 }),
      }),
    );

    const result = registry.processPacket(makePacket({ hr: 60 }));
    // 60 * 2 = 120, then 120 + 10 = 130
    expect(result.hr).toBe(130);
  });

  it('processPacket skips plugins without onPacket', () => {
    const registry = new PluginRegistry();

    registry.register(makePlugin({ name: 'no-hook' }));
    registry.register(
      makePlugin({
        name: 'with-hook',
        onPacket: (p) => ({ ...p, hr: p.hr + 1 }),
      }),
    );

    const result = registry.processPacket(makePacket({ hr: 100 }));
    expect(result.hr).toBe(101);
  });

  // ── notifyRoundStart / notifyRoundEnd ────────────────────────────────

  it('notifyRoundStart calls hooks in registration order', () => {
    const registry = new PluginRegistry();
    const order: string[] = [];

    registry.register(
      makePlugin({
        name: 'first',
        onRoundStart: () => order.push('first'),
      }),
    );
    registry.register(
      makePlugin({
        name: 'second',
        onRoundStart: () => order.push('second'),
      }),
    );

    registry.notifyRoundStart(0, { label: 'warmup' });
    expect(order).toEqual(['first', 'second']);
  });

  it('notifyRoundStart passes roundIndex and meta to hooks', () => {
    const registry = new PluginRegistry();
    const hook = vi.fn();
    registry.register(makePlugin({ name: 'meta-check', onRoundStart: hook }));

    const meta = { label: 'round-1' };
    registry.notifyRoundStart(2, meta);

    expect(hook).toHaveBeenCalledWith(2, meta);
  });

  it('notifyRoundEnd calls hooks with round data', () => {
    const registry = new PluginRegistry();
    const hook = vi.fn();
    registry.register(makePlugin({ name: 'round-end', onRoundEnd: hook }));

    const round = makeRound({ index: 1 });
    registry.notifyRoundEnd(round);

    expect(hook).toHaveBeenCalledWith(round);
  });

  // ── notifySessionEnd ─────────────────────────────────────────────────

  it('notifySessionEnd calls hooks with session', () => {
    const registry = new PluginRegistry();
    const hook = vi.fn();
    registry.register(makePlugin({ name: 'session-end', onSessionEnd: hook }));

    const session = makeSession();
    registry.notifySessionEnd(session);

    expect(hook).toHaveBeenCalledWith(session);
  });

  it('notifySessionEnd calls all plugin hooks', () => {
    const registry = new PluginRegistry();
    const hookA = vi.fn();
    const hookB = vi.fn();
    registry.register(makePlugin({ name: 'a', onSessionEnd: hookA }));
    registry.register(makePlugin({ name: 'b', onSessionEnd: hookB }));

    registry.notifySessionEnd(makeSession());

    expect(hookA).toHaveBeenCalledOnce();
    expect(hookB).toHaveBeenCalledOnce();
  });

  // ── collectAnalytics ─────────────────────────────────────────────────

  it('collectAnalytics merges results from multiple plugins', () => {
    const registry = new PluginRegistry();

    registry.register(
      makePlugin({
        name: 'stats-a',
        onAnalyze: () => ({ avgPower: 250, cadence: 90 }),
      }),
    );
    registry.register(
      makePlugin({
        name: 'stats-b',
        onAnalyze: () => ({ elevation: 1200 }),
      }),
    );

    const result = registry.collectAnalytics(makeSession());
    expect(result).toEqual({ avgPower: 250, cadence: 90, elevation: 1200 });
  });

  it('collectAnalytics lets later plugins override earlier keys', () => {
    const registry = new PluginRegistry();

    registry.register(
      makePlugin({
        name: 'first',
        onAnalyze: () => ({ score: 10 }),
      }),
    );
    registry.register(
      makePlugin({
        name: 'second',
        onAnalyze: () => ({ score: 42 }),
      }),
    );

    const result = registry.collectAnalytics(makeSession());
    expect(result).toEqual({ score: 42 });
  });

  it('collectAnalytics returns empty object when no plugins have onAnalyze', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin({ name: 'no-analyze' }));

    expect(registry.collectAnalytics(makeSession())).toEqual({});
  });

  // ── clear ────────────────────────────────────────────────────────────

  it('clear calls onDestroy for all plugins', () => {
    const registry = new PluginRegistry();
    const destroyA = vi.fn();
    const destroyB = vi.fn();
    registry.register(makePlugin({ name: 'a', onDestroy: destroyA }));
    registry.register(makePlugin({ name: 'b', onDestroy: destroyB }));

    registry.clear();

    expect(destroyA).toHaveBeenCalledOnce();
    expect(destroyB).toHaveBeenCalledOnce();
  });

  it('clear removes all plugins', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin({ name: 'x' }));
    registry.register(makePlugin({ name: 'y' }));

    registry.clear();

    expect(registry.getAll()).toEqual([]);
    expect(registry.has('x')).toBe(false);
    expect(registry.has('y')).toBe(false);
  });

  it('can re-register a plugin after clear', () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin({ name: 're-add' });
    registry.register(plugin);
    registry.clear();

    expect(() => registry.register(plugin)).not.toThrow();
    expect(registry.has('re-add')).toBe(true);
  });
});

describe('error resilience', () => {
  it('processPacket survives a plugin that throws', () => {
    const registry = new PluginRegistry();
    const throwingPlugin: HRKitPlugin = {
      name: 'crasher',
      version: '1.0',
      onPacket: () => {
        throw new Error('boom');
      },
    };
    const goodPlugin: HRKitPlugin = {
      name: 'doubler',
      version: '1.0',
      onPacket: (p) => ({ ...p, hr: p.hr * 2 }),
    };
    registry.register(throwingPlugin);
    registry.register(goodPlugin);

    const packet = { timestamp: 1000, hr: 80, rrIntervals: [], contactDetected: true };
    const result = registry.processPacket(packet);
    expect(result.hr).toBe(160);
  });

  it('notifyRoundStart survives a plugin that throws', () => {
    const registry = new PluginRegistry();
    const calls: number[] = [];
    registry.register({
      name: 'crasher',
      version: '1.0',
      onRoundStart: () => {
        throw new Error('boom');
      },
    });
    registry.register({
      name: 'tracker',
      version: '1.0',
      onRoundStart: (idx) => {
        calls.push(idx);
      },
    });

    registry.notifyRoundStart(0);
    expect(calls).toEqual([0]);
  });

  it('notifyRoundEnd survives a plugin that throws', () => {
    const registry = new PluginRegistry();
    const calls: number[] = [];
    const round: Round = { index: 0, startTime: 0, endTime: 1000, samples: [], rrIntervals: [] };
    registry.register({
      name: 'crasher',
      version: '1.0',
      onRoundEnd: () => {
        throw new Error('boom');
      },
    });
    registry.register({
      name: 'tracker',
      version: '1.0',
      onRoundEnd: (r) => {
        calls.push(r.index);
      },
    });

    registry.notifyRoundEnd(round);
    expect(calls).toEqual([0]);
  });

  it('notifySessionEnd survives a plugin that throws', () => {
    const registry = new PluginRegistry();
    const calls: string[] = [];
    const session = makeSession();
    registry.register({
      name: 'crasher',
      version: '1.0',
      onSessionEnd: () => {
        throw new Error('boom');
      },
    });
    registry.register({
      name: 'tracker',
      version: '1.0',
      onSessionEnd: () => {
        calls.push('called');
      },
    });

    registry.notifySessionEnd(session);
    expect(calls).toEqual(['called']);
  });

  it('collectAnalytics survives a plugin that throws', () => {
    const registry = new PluginRegistry();
    registry.register({
      name: 'crasher',
      version: '1.0',
      onAnalyze: () => {
        throw new Error('boom');
      },
    });
    registry.register({ name: 'good', version: '1.0', onAnalyze: () => ({ score: 42 }) });

    const session = makeSession();
    const result = registry.collectAnalytics(session);
    expect(result).toEqual({ score: 42 });
  });
});

describe('re-registration', () => {
  it('allows re-registering after unregister', () => {
    const registry = new PluginRegistry();
    const initCalls: string[] = [];
    const plugin: HRKitPlugin = {
      name: 'test',
      version: '1.0',
      onInit: () => {
        initCalls.push('init');
      },
      onDestroy: () => {
        initCalls.push('destroy');
      },
    };

    registry.register(plugin);
    registry.unregister('test');
    registry.register(plugin);
    expect(initCalls).toEqual(['init', 'destroy', 'init']);
    expect(registry.has('test')).toBe(true);
  });
});
