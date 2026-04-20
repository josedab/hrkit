# Deprecation Policy

This policy defines how `@hrkit/*` retires public surface area.

## Goals

1. Give integrators **at least one minor release** of warning before any removal.
2. Provide a **clear migration path** in code, not just docs — every deprecated symbol references its replacement.
3. Make removal a **major-version-only** event for stable (≥ 1.0) packages.

## Mechanics

### 1. Mark with `@deprecated`

```ts
/**
 * @deprecated since 0.7.0 — use {@link parseHeartRateMeasurement} instead. Removed in 1.0.
 */
export function parseHRM(view: DataView) { /* ... */ }
```

The JSDoc tag is enforced by the IDE strikethrough and surfaced by TypeDoc in the published API reference.

### 2. Add a Changeset

```
- Deprecate `parseHRM`. Use `parseHeartRateMeasurement` instead. Removal scheduled for 1.0.
```

Mark the bump as `minor` (or `patch` for pre-1.0).

### 3. Keep the symbol working

Deprecated symbols must remain functionally equivalent for the duration of the deprecation window. They may delegate to the replacement.

```ts
export function parseHRM(view: DataView) {
  return parseHeartRateMeasurement(view);
}
```

### 4. Wait the minimum window

| Stability | Minimum window before removal               |
| --------- | -------------------------------------------- |
| Stable (≥ 1.0) | **2 minor versions** AND ≥ 60 days     |
| Pre-1.0 (`0.x`)| **1 minor version**                    |
| Experimental / `_internal`-prefixed | No window — removable any time |

### 5. Remove on a major version

Removal must coincide with a major-version bump for stable packages. The Changeset entry must reference the prior deprecation:

```
- **BREAKING:** Remove `parseHRM` (deprecated in 0.7.0). Use `parseHeartRateMeasurement`.
```

## Runtime Warnings (Optional)

For high-blast-radius deprecations (e.g., a default behavior change), emit a one-time `console.warn` via the Logger:

```ts
import { getLogger } from '@hrkit/core';

let warned = false;
export function parseHRM(view: DataView) {
  if (!warned) {
    warned = true;
    getLogger().warn('parseHRM is deprecated, use parseHeartRateMeasurement');
  }
  return parseHeartRateMeasurement(view);
}
```

Only do this when the integrator's code is broken or silently wrong without action.

## Stability Tiers

| Tier        | Conventions                                                                |
| ----------- | --------------------------------------------------------------------------- |
| **Stable**  | Default for any symbol exported from a package's barrel. Honors this policy.|
| **Beta**    | Documented with a `@beta` tag. May change in minor releases with a changelog entry. |
| **Experimental** | Documented with `@experimental`. May change or disappear in any release. |
| **Internal** | Not exported from the barrel. May change without notice.                 |

## Audit Trail

The list of currently-deprecated symbols lives in [docs/DEPRECATIONS.md](./DEPRECATIONS.md) (created lazily on the first deprecation in a release cycle).
