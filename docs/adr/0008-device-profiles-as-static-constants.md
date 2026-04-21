# ADR 0008: Device Profiles as Static Constants

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

The SDK must identify BLE devices during scan to determine capabilities.
A Polar H10 supports ECG streaming; a Wahoo TICKR does not. The SDK
needs a way to map discovered devices to their capabilities at scan time,
before a connection is established.

Two approaches were considered: a dynamic registry (register profiles at
runtime, lookup by advertised name/service) or static constant objects
(import the profile you want, pass it to `connectToDevice`).

## Decision

Device profiles are plain `DeviceProfile` objects exported as `const`
values from `packages/core/src/profiles/`:

```ts
interface DeviceProfile {
  brand: string;
  model: string;
  namePrefix: string;        // BLE advertised name prefix for scan matching
  capabilities: Capability[];
  serviceUUIDs: string[];
}
```

Built-in profiles are organized by vendor in separate files
(`garmin.ts`, `wahoo.ts`, `polar.ts`, `coospo.ts`, `suunto.ts`,
`trainers.ts`, `cgm.ts`) and re-exported through
`packages/core/src/profiles/index.ts`.

`GENERIC_HR` has an empty `namePrefix`, acting as a catch-all for any
device advertising the standard Heart Rate service.

Device matching in `connectToDevice()` works by:
1. Iterating preferred profiles in order
2. Matching by `namePrefix` (case-insensitive `startsWith`)
3. Falling back to profiles with empty `namePrefix`

Custom profiles are just objects — consumers create them inline:

```ts
const MY_DEVICE: DeviceProfile = {
  brand: 'MyBrand', model: 'MyModel', namePrefix: 'MY',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
```

## Consequences

### Positive

- Profiles are tree-shakeable — import only the brands you target.
- No runtime registration ceremony. Import a constant, pass it to a
  function.
- Custom profiles require zero SDK changes. No plugin or registry to
  learn.
- TypeScript `as const` ensures profiles are immutable and narrowly
  typed.

### Negative

- Adding a new built-in profile requires a code change and a
  semver-minor release.
- No dynamic discovery — you can't ask "what profiles are available?"
  at runtime without importing them all.
- `namePrefix` matching is simplistic (no regex, no UUID-based matching
  beyond service filter). Works for all known HR devices but could be
  insufficient for devices with highly variable advertised names.

## Alternatives Considered

1. **Plugin-style profile registry** (`registerProfile(profile)`) —
   rejected: adds ceremony without benefit. Profiles are small,
   stateless objects. A registry adds mutable global state that could
   cause test isolation issues.

2. **Automatic identification from GATT services** (no profiles) —
   rejected: BLE scan results don't reliably include all service UUIDs
   on all platforms (especially on iOS). Name-based matching is more
   reliable in practice.

3. **Subclassing or tagged union** — rejected: profiles are data, not
   behavior. A plain interface is simpler and composes better.

## References

- Source: `packages/core/src/profiles/` (index, garmin, wahoo, etc.)
- Matching: `packages/core/src/connect.ts` → `matchProfile()`
- Consumer guide: `CONTRIBUTING.md` → "Adding a Device Profile"
- Conformance: `fixtures/conformance/` (each fixture references a
  profile brand/model)
