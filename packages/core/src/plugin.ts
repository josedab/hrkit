import { HRKitError } from './errors.js';
import type { HRPacket, Round, RoundMeta, Session } from './types.js';

/** Lifecycle hooks that a plugin can implement. All hooks are optional. */
export interface HRKitPlugin {
  /** Unique plugin identifier. */
  readonly name: string;
  /** Plugin version string. */
  readonly version: string;

  /** Called when the plugin is registered. */
  onInit?(): void;
  /** Called for each incoming HR packet during recording. Can transform the packet. */
  onPacket?(packet: HRPacket): HRPacket | undefined;
  /** Called when a round starts. */
  onRoundStart?(roundIndex: number, meta?: RoundMeta): void;
  /** Called when a round ends. */
  onRoundEnd?(round: Round): void;
  /** Called when a session ends. */
  onSessionEnd?(session: Session): void;
  /** Called during analyzeSession. Returns custom metrics to merge into results. */
  onAnalyze?(session: Session): Record<string, unknown>;
  /** Called when the plugin is unregistered. */
  onDestroy?(): void;
}

/**
 * Registry that manages plugins and invokes their lifecycle hooks.
 */
export class PluginRegistry {
  private plugins: Map<string, HRKitPlugin> = new Map();

  /**
   * Register a plugin. Calls `onInit()` if defined.
   *
   * @param plugin - Plugin instance to register.
   * @throws {HRKitError} if a plugin with the same name is already registered.
   */
  register(plugin: HRKitPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new HRKitError(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    plugin.onInit?.();
  }

  /**
   * Unregister a plugin by name. Calls `onDestroy()` if defined. No-op if not found.
   *
   * @param name - Unique plugin identifier.
   */
  unregister(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.onDestroy?.();
      this.plugins.delete(name);
    }
  }

  /** Get a registered plugin by name. */
  get(name: string): HRKitPlugin | undefined {
    return this.plugins.get(name);
  }

  /** Get all registered plugins in registration order. */
  getAll(): HRKitPlugin[] {
    return [...this.plugins.values()];
  }

  /** Check if a plugin is registered. */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Invoke onPacket hooks in registration order.
   * Misbehaving plugins are silently skipped to avoid crashing the pipeline.
   *
   * @param packet - The incoming HR packet.
   * @returns The (possibly transformed) packet after all plugins have processed it.
   */
  processPacket(packet: HRPacket): HRPacket {
    let current = packet;
    for (const plugin of this.plugins.values()) {
      if (plugin.onPacket) {
        try {
          const result = plugin.onPacket(current);
          if (result !== undefined) {
            current = result;
          }
        } catch {
          // Skip misbehaving plugins — do not let one plugin crash the pipeline.
        }
      }
    }
    return current;
  }

  /**
   * Invoke onRoundStart hooks.
   *
   * @param roundIndex - Zero-based index of the round starting.
   * @param meta - Optional round metadata.
   */
  notifyRoundStart(roundIndex: number, meta?: RoundMeta): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.onRoundStart?.(roundIndex, meta);
      } catch {
        // Skip misbehaving plugins.
      }
    }
  }

  /**
   * Invoke onRoundEnd hooks.
   *
   * @param round - The completed round data.
   */
  notifyRoundEnd(round: Round): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.onRoundEnd?.(round);
      } catch {
        // Skip misbehaving plugins.
      }
    }
  }

  /**
   * Invoke onSessionEnd hooks.
   *
   * @param session - The completed session.
   */
  notifySessionEnd(session: Session): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.onSessionEnd?.(session);
      } catch {
        // Skip misbehaving plugins.
      }
    }
  }

  /**
   * Invoke onAnalyze hooks and merge custom metrics from all plugins.
   *
   * @param session - The session to analyze.
   * @returns Merged key-value record of custom metrics from all plugins.
   */
  collectAnalytics(session: Session): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const plugin of this.plugins.values()) {
      if (plugin.onAnalyze) {
        try {
          Object.assign(merged, plugin.onAnalyze(session));
        } catch {
          // Skip misbehaving plugins.
        }
      }
    }
    return merged;
  }

  /** Unregister all plugins (calls onDestroy for each). */
  clear(): void {
    for (const plugin of this.plugins.values()) {
      plugin.onDestroy?.();
    }
    this.plugins.clear();
  }
}
