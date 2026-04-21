# ADR 0005: Session Schema Versioning

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

`Session` objects are serialized to JSON for storage, export, and
cross-device synchronization. As the SDK evolves, the session structure
changes — new fields are added, existing fields are renamed or
restructured, and deprecated fields are removed.

Without versioning:

- Old persisted sessions become unreadable after schema changes.
- Consumers cannot distinguish between "missing field" and "field
  didn't exist in this version."
- There is no safe path to migrate historical data.

Athletes may have months or years of recorded sessions. Losing this
data due to a schema change is unacceptable.

## Decision

Every `Session` object includes a **`schemaVersion`** field, exported
as the constant `SESSION_SCHEMA_VERSION` (currently `1`).

Deserialization via `sessionFromJSON()` follows this process:

1. Read the `schemaVersion` from the JSON payload (default to `0` if
   absent for pre-versioning data).
2. Apply **single-step migrators** in sequence (v→v+1) until the
   version matches `SESSION_SCHEMA_VERSION`.
3. Validate the resulting object against the Session type.

Design constraints:

- **Single-step migrators only** (v→v+1). Each migrator is a pure
  function: `(session: unknown) => unknown`.
- **Max hop limit of 64.** Multi-hop migrations beyond this limit are
  rejected to prevent runaway transforms from malicious or corrupted
  input.
- **JSON Schema validation.** A JSON Schema (draft 2020-12) defines
  the canonical session structure. `sessionFromJSON()` supports a
  `strict` mode that validates every sample against this schema.
- **Custom migrators.** Consumers can register additional migrators for
  downstream schema extensions without forking core.

## Consequences

### Positive

- Forward and backward compatibility for persisted sessions. Old data
  is automatically migrated on load.
- Consumers can add custom migrators for their own schema extensions
  (e.g. app-specific metadata fields).
- Strict mode validates every sample for untrusted input (e.g. data
  received from cloud sync or third-party imports).
- JSON Schema enables validation by external tooling (IDEs, CI
  pipelines, data warehouses).

### Negative / trade-offs

- Migrators must be written and tested for every breaking schema
  change. This adds development overhead.
- The 64-hop limit means sessions more than 64 schema versions behind
  cannot be migrated in a single pass. In practice, this is unlikely
  but enforced as a security boundary.
- Schema validation in strict mode adds O(n) overhead for large
  sessions (thousands of samples). Non-strict mode skips this for
  performance-sensitive paths.

## Alternatives considered

1. **Breaking changes only (no migration).** Rejected because it would
   cause data loss for athletes with historical sessions. This is
   unacceptable for a fitness/health SDK.

2. **Protocol Buffers (Protobuf).** Rejected because it adds a build
   step (protoc compilation), is not human-readable (harder to debug),
   and doesn't align with the zero-dependency philosophy of core.

3. **Custom binary format.** Rejected due to tooling cost,
   debuggability concerns, and the overhead of building serialization
   and deserialization from scratch without ecosystem support.

## References

- Migration logic: `packages/core/src/session-migrations.ts`
- Serialization API: `packages/core/src/session-serialization.ts`
- Schema version constant: `packages/core/src/types.ts` (`SESSION_SCHEMA_VERSION`)
