# Changelog Conventions

`@hrkit/*` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning 2.0](https://semver.org/).

Each released package keeps its own `CHANGELOG.md`, generated from [Changesets](https://github.com/changesets/changesets) entries.

## Authoring a Changeset

Run `pnpm changeset` and answer the prompts. Pick the impacted packages, the SemVer bump, and write a short summary in the imperative mood:

```
- Add `signal` option to `BLETransport.connect()` so callers can cancel a stalled scan.
```

Group entries under the appropriate Keep-a-Changelog category. Changesets supports prefixes; if you leave one out, the release maintainer will categorize it before publishing.

| Category    | Use for                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| Added       | New public symbols, new options on existing symbols, new packages.                  |
| Changed     | Behavior changes that are **not** breaking (defaults, perf, error message wording). |
| Deprecated  | Symbols still callable but slated for removal — see DEPRECATION-POLICY.md.          |
| Removed     | Symbols deleted in a major release. Must reference the prior `Deprecated` entry.    |
| Fixed       | Bug fixes that don't add or change public surface.                                  |
| Security    | Security-relevant fixes. Always include a brief threat model note.                  |

## SemVer Mapping

| Change                               | Bump  |
| ------------------------------------ | ----- |
| Added (new symbol or option)         | minor |
| Fixed                                | patch |
| Changed (non-breaking)               | patch |
| Deprecated                           | minor |
| Removed / Changed (breaking)         | major |
| Security (no surface change)         | patch |

If a single PR touches both the public surface and an internal-only refactor, only the public-facing change determines the bump.

## Pre-1.0 Caveat

Packages still on `0.x` follow a softer SemVer: minor bumps **may** include breaking changes, but they must still be flagged in the changelog under `Changed` with a `**BREAKING:**` prefix.

## Public API Surface Snapshot

The repo includes a snapshot test (`packages/core/src/__tests__/api-surface.test.ts`) that fails when any package's public exports change. Accept the snapshot diff intentionally — it is the trigger to add a Changeset entry.
