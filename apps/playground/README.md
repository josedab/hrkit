# @hrkit playground

Single-page Vite app that demonstrates `@hrkit/core` + `@hrkit/web` directly in
the browser. No backend, no install — pair a real BLE strap or replay a
fixture from `fixtures/conformance/`.

```bash
pnpm --filter @hrkit/playground dev
# → http://localhost:5176
```

## Modes

- **Live** — Web Bluetooth pairing. Chrome/Edge over `https://` or `localhost`.
- **Replay fixture** — pulls a frozen capture from the conformance corpus and
  re-runs the parser. Handy for offline demos.
- **Share** — generates a `?mode=…&name=…` URL that re-opens the same view.

> Fixtures are served at `/fixtures/<name>.json`. In production this is a
> mirror of `fixtures/conformance/` placed under the website's `static/` dir
> by the build pipeline.
