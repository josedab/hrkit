# ADR 0002: Zero-Dependency Core

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

`@hrkit/core` must run on every mainstream JavaScript runtime — React
Native, Web browsers, Node.js, Cloudflare Workers, Deno, and Bun — all
without bundler tricks or polyfills.

Adding runtime dependencies creates three categories of risk:

1. **Supply chain risk.** Transitive dependencies multiply the attack
   surface. A single compromised upstream package (cf. `event-stream`,
   `colors.js`) could affect every consumer.
2. **Version conflicts.** In a monorepo with platform adapters, a shared
   dependency at different versions causes deduplication failures and
   subtle runtime bugs — especially in React Native's metro bundler.
3. **Platform compatibility.** Many npm packages assume Node built-ins
   (`Buffer`, `fs`, `crypto`) or browser globals (`window`,
   `navigator`). These assumptions break in edge runtimes and React
   Native.

All metric functions — HRV (RMSSD, SDNN, pNN50), TRIMP, zone
distribution, FFT, Kalman filter, DFA, Lomb-Scargle periodogram — are
implemented directly in TypeScript source.

## Decision

`@hrkit/core` has **zero runtime dependencies**. Its `package.json`
contains no `dependencies` field.

All algorithms are implemented inline in TypeScript:

- **HRV time-domain** (RMSSD, SDNN, pNN50) in `hrv.ts`
- **HRV frequency-domain** (Lomb-Scargle periodogram, spectral power)
  in `hrv-advanced.ts`
- **Detrended Fluctuation Analysis** (DFA α1) in `hrv-advanced.ts`
- **Kalman filter** for sensor fusion in `sensor-fusion.ts`
- **FFT** for frequency-domain analysis
- **TRIMP** (Bannister method) in `trimp.ts`
- **Zone distribution** in `zones.ts`
- **Artifact detection/filtering** in `artifact-filter.ts`

Platform-specific code (BLE stacks, native modules, DOM APIs) lives in
separate adapter packages (`@hrkit/web`, `@hrkit/react-native`,
`@hrkit/capacitor`, etc.).

DevDependencies (`vitest`, `tsup`, `typescript`, `@types/*`) are
allowed — they are not shipped to consumers.

## Consequences

### Positive

- Works in every JavaScript runtime without polyfills or bundler
  configuration.
- Tree-shaking is trivial — no opaque `node_modules` subgraphs to
  analyze.
- No supply chain risk from transitive runtime dependencies.
- Bundle size stays predictable (~17 kB) and easy to audit.

### Negative / trade-offs

- Must implement algorithms inline (FFT, Kalman, Lomb-Scargle) rather
  than using mature, battle-tested libraries.
- More code to maintain; harder to benefit from upstream improvements
  or bug fixes in established math libraries.
- Some algorithms (e.g. DFA) are simplified versions optimized for
  real-time HR data, not research-grade general-purpose
  implementations.

## Alternatives considered

1. **Use RxJS for observables.** Rejected: ~200 kB, assumes
   `globalThis` patterns that break in Workers, and couples core to a
   specific reactive paradigm. Instead, a minimal `SimpleStream`
   provides BehaviorSubject-like semantics in ~50 lines.

2. **Use mathjs or jstat for statistics.** Rejected: 300 kB+, pulls in
   dozens of transitive deps, and most functionality is unused. The
   subset of statistics needed (mean, stddev, percentiles) is trivial
   to implement.

3. **Use fft.js for frequency-domain analysis.** Rejected: supply
   chain concerns, bundler compatibility issues with Workers/Deno, and
   the HR-specific FFT use case is narrow enough to implement inline.

## References

- Source: `packages/core/package.json` (no `dependencies` field)
- Inline Lomb-Scargle: `packages/core/src/hrv-advanced.ts`
- Inline Kalman filter: `packages/core/src/sensor-fusion.ts`
- Inline artifact filter: `packages/core/src/artifact-filter.ts`
