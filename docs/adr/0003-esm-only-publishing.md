# ADR 0003: ESM-Only Publishing

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** @hrkit maintainers

## Context

Publishing npm packages in both CommonJS (CJS) and ES Modules (ESM)
formats introduces several problems:

1. **Dual-package hazard.** When a package is loaded as both CJS and ESM
   in the same process (e.g. via transitive dependencies), Node.js
   creates two separate module instances. Singletons, `instanceof`
   checks, and shared state all break silently.
2. **Doubled build output.** Maintaining two build targets doubles CI
   time, artifact size, and the surface area for build bugs (mismatched
   exports, missing files).
3. **Conditional exports complexity.** Getting `"exports"` maps correct
   for every consumer (Node CJS, Node ESM, bundlers, TypeScript) is
   notoriously error-prone and a constant source of bug reports.

All target runtimes for `@hrkit` support ESM natively:

- Node.js ≥ 16 (with `"type": "module"`)
- All modern browsers (via `<script type="module">`)
- React Native (Metro bundler)
- Deno, Bun, Cloudflare Workers (ESM-native)

## Decision

All `@hrkit` packages ship **ESM only**:

- Every `package.json` sets `"type": "module"`.
- The `"exports"` field uses only the `"import"` condition — no
  `"require"` condition.
- `tsup` is configured with `format: ['esm']` — no CJS or UMD output.
- No IIFE or UMD bundles are produced. The `@hrkit/bundle` package
  serves the CDN/quick-start use case with a pre-bundled ESM
  distribution.

## Consequences

### Positive

- No dual-package hazard — each package is loaded exactly once per
  process.
- Proper tree-shaking in all modern bundlers (Vite, esbuild, Rollup,
  Webpack 5).
- Top-level `await` is available where needed.
- Simpler build pipeline — one format, one output directory.
- Aligns with the ecosystem direction (Node.js, Deno, browsers all
  moving to ESM-first).

### Negative / trade-offs

- CJS consumers must use dynamic `await import()` to load `@hrkit`
  packages. This is a minor inconvenience for legacy Node.js projects.
- Legacy bundlers (Webpack 4, Browserify) are not supported. Projects
  using these tools must upgrade or use `@hrkit/bundle`.
- Some test frameworks (Jest without `--experimental-vm-modules`)
  require additional ESM configuration. Vitest handles ESM natively.

## Alternatives considered

1. **Dual ESM+CJS with conditional exports.** Rejected due to the
   dual-package hazard, increased build complexity, and the maintenance
   burden of keeping two output formats in sync. Real-world experience
   shows this is a persistent source of bugs.

2. **UMD for CDN distribution.** Rejected because `@hrkit/bundle`
   already serves this use case with a pre-bundled ESM distribution
   that works via `<script type="module">` or CDN imports
   (`esm.sh`, `skypack`).

## References

- Policy document: `docs/esm-only.md`
- Package exports example: `packages/core/package.json` (`"exports"` field)
- Biome configuration: `biome.json`
