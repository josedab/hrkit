import type {
  BLETransport,
  ConnectOptions,
  DeviceProfile,
  HRConnection,
  HRDevice,
} from './types.js';
import { DeviceNotFoundError, TimeoutError } from './errors.js';

/**
 * Match a discovered device against profiles by service UUIDs and name prefix.
 */
function matchProfile(device: HRDevice, profiles: DeviceProfile[]): DeviceProfile | undefined {
  for (const profile of profiles) {
    if (profile.namePrefix && device.name) {
      if (device.name.startsWith(profile.namePrefix)) {
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
 */
export async function connectToDevice(
  transport: BLETransport,
  options: ConnectOptions = {},
): Promise<HRConnection> {
  const { prefer = [], fallback, timeoutMs = 10000 } = options;
  const allProfiles = fallback ? [...prefer, fallback] : [...prefer];

  if (allProfiles.length === 0) {
    throw new DeviceNotFoundError('No device profiles specified. Provide at least one profile in prefer or fallback.');
  }

  const discovered = new Map<string, { device: HRDevice; profile: DeviceProfile; rank: number }>();

  const scanTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError('Scan timeout')), timeoutMs);
  });

  const scanLoop = async (): Promise<HRConnection> => {
    try {
      for await (const device of transport.scan(allProfiles)) {
        // Try preferred profiles first (higher priority = lower index)
        for (let i = 0; i < prefer.length; i++) {
          const profile = prefer[i]!;
          const nameMatches = profile.namePrefix === '' || device.name?.startsWith(profile.namePrefix);
          if (nameMatches) {
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
      // Scan ended or was stopped
    }

    // If scan ended without a preferred match, use best discovered fallback
    if (discovered.size > 0) {
      const best = [...discovered.values()].sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.device.rssi - a.device.rssi; // prefer stronger signal
      })[0]!;
      return transport.connect(best.device.id, best.profile);
    }

    throw new DeviceNotFoundError('No compatible device found');
  };

  try {
    return await Promise.race([scanLoop(), scanTimeout]);
  } finally {
    await transport.stopScan().catch(() => {});
  }
}
