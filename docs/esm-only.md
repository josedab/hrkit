# ESM-Only Policy

`@hrkit/*` packages are published as **ESM only**. There is no CJS (`require()`) build, no UMD, no IIFE.

## Rationale

- The core SDK targets modern runtimes (Node ≥ 18, evergreen browsers, React Native, Edge runtimes). All support native ESM.
- Dual-publishing (ESM + CJS) doubles the maintenance and bundle-size footprint and historically introduces subtle bugs with conditional exports.
- ESM enables proper tree-shaking, top-level `await`, and standardized module resolution.

## Runtime Matrix

| Runtime              | Minimum   | Notes                                                 |
| -------------------- | --------- | ----------------------------------------------------- |
| Node.js              | 18 LTS    | Use `"type": "module"` in your `package.json`.        |
| Browsers             | ES2020    | Modern Chromium, Firefox, Safari (last 2 versions).   |
| React Native         | 0.72+     | Hermes with `import`/`export` support.                |
| Cloudflare Workers   | latest    | Native ESM via Workers Modules format.                |
| Vercel Edge          | latest    | Native ESM.                                           |
| Deno                 | 1.30+     | Use `npm:` specifiers or import maps.                 |
| Bun                  | 1.0+      | Native.                                               |

## Consuming from CommonJS

If you must consume from a CJS file, use dynamic `import()`:

```js
// CommonJS — must use dynamic import for ESM-only deps.
const { parseHR } = await import('@hrkit/core');
```

We do **not** plan to add a CJS build. Track [discussion #esm-only](https://github.com/josedab/hrkit/discussions) for context.

## Per-Package Engines

Every published `@hrkit/*` package sets:

```json
{
  "type": "module",
  "engines": { "node": ">=18" },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

Do not introduce a `"require"` condition. PRs that add CJS output will be closed.

## Bundler Notes

- **Webpack 5+, Rollup, Vite, esbuild, Turbopack, Parcel 2** — all handle ESM natively.
- **Webpack 4 / Browserify / older bundlers** — not supported.
- For framework consumers (Next.js, Remix, Nuxt, SvelteKit), no special config is needed; ESM packages are first-class.
