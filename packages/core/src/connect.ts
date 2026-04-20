import { DeviceNotFoundError, TimeoutError } from './errors.js';
import { getLogger } from './logger.js';
import type { BLETransport, ConnectOptions, DeviceProfile, HRConnection, HRDevice } from './types.js';

/**
 * Match a discovered device against profiles by service UUIDs and name prefix.
 */
function matchProfile(device: HRDevice, profiles: DeviceProfile[]): DeviceProfile | undefined {
  for (const profile of profiles) {
    if (profile.namePrefix && device.name) {
      if (device.name.toLowerCase().startsWith(profile.namePrefix.toLowerCase())) {
        return profile;
      }
    }
  }
  // If no namePrefix match, return profile with empty prefix (generic fallback)
  return profiles.find((p) => p.namePrefix === '');
}

/**
 * Connect to the best available BLE HR device.
 *
 * Scans for devices, tries to match against preferred profiles first,
 * then falls back to the fallback profile. For web transports that yield
 * a single user-selected device, this resolves immediately.
 *
 * @param transport - Platform-specific BLE transport implementation.
 * @param options - Connection options (preferred profiles, fallback, timeout).
 * @returns A connected {@link HRConnection}.
 * @throws {DeviceNotFoundError} if no compatible device is found.
 * @throws {TimeoutError} if the scan exceeds `timeoutMs`.
 *
 * @example
 * ```typescript
 * const connection = await connectToDevice(transport, {
 *   prefer: [polarH10Profile],
 *   timeoutMs: 15000,
 * });
 * ```
 */
export async function connectToDevice(transport: BLETransport, options: ConnectOptions = {}): Promise<HRConnection> {
  const { prefer = [], fallback, timeoutMs = 10000 } = options;
  const allProfiles = fallback ? [...prefer, fallback] : [...prefer];

  if (allProfiles.length === 0) {
    throw new DeviceNotFoundError('No device profiles specified. Provide at least one profile in prefer or fallback.');
  }

  const discovered = new Map<string, { device: HRDevice; profile: DeviceProfile; rank: number }>();

  // Use AbortController so the timeout handle is cleared whenever the scan
  // resolves first — avoids a leaked setTimeout that would otherwise hold the
  // event loop open until `timeoutMs`.
  const ac = new AbortController();
  const scanTimeout = new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new TimeoutError('Scan timeout')), timeoutMs);
    ac.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  });

  const scanLoop = async (): Promise<HRConnection> => {
    const log = getLogger();
    log.debug('connectToDevice: scanning', {
      preferCount: prefer.length,
      hasFallback: !!fallback,
      timeoutMs,
    });

    try {
      for await (const device of transport.scan(allProfiles)) {
        log.debug('connectToDevice: device discovered', {
          id: device.id,
          name: device.name,
          rssi: device.rssi,
        });

        // Try preferred profiles first (higher priority = lower index)
        for (let i = 0; i < prefer.length; i++) {
          const profile = prefer[i]!;
          const nameMatches =
            profile.namePrefix === '' ||
            (device.name?.toLowerCase().startsWith(profile.namePrefix.toLowerCase()) ?? false);
          if (nameMatches) {
            log.info('connectToDevice: matched preferred profile', {
              profile: `${profile.brand} ${profile.model}`,
              deviceName: device.name,
            });
            await transport.stopScan();
            return transport.connect(device.id, profile);
          }
        }

        // Check for fallback match
        if (fallback) {
          const matched = matchProfile(device, [fallback]);
          if (matched) {
            discovered.set(device.id, { device, profile: matched, rank: prefer.length });
          }
        }
      }
    } catch {
      // Scan stream ended (normal completion, timeout, or transport error).
      // Fall through to check discovered fallback devices.
    }

    // If scan ended without a preferred match, use best discovered fallback
    if (discovered.size > 0) {
      const best = [...discovered.values()].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.device.rssi - a.device.rssi; // prefer stronger signal
      })[0]!;
      log.info('connectToDevice: using fallback device', {
        deviceName: best.device.name,
        profile: `${best.profile.brand} ${best.profile.model}`,
      });
      return transport.connect(best.device.id, best.profile);
    }

    throw new DeviceNotFoundError('No compatible device found');
  };

  try {
    return await Promise.race([scanLoop(), scanTimeout]);
  } finally {
    ac.abort();
    await transport.stopScan().catch(() => {
      /* Ignore — scan may already be stopped. */
    });
  }
}
