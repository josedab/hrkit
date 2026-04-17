# @hrkit/demo

Public live demo of `@hrkit` — runs entirely in the browser, deployable to any static host (Vercel, Netlify, Cloudflare Pages).

## Scenarios

- **Live BLE sensor** — uses Web Bluetooth to connect to any standard heart-rate monitor (Polar H10, Garmin HRM-Pro, Wahoo TICKR, etc.). Chrome/Edge only, requires HTTPS or `localhost`.
- **Simulated workout** — runs a Tabata profile with synthetic ECG. Works in every browser.
- **Replay recording** — plays back a canned 2-minute easy-run trace at 4× speed.

## Run locally

```bash
pnpm install
pnpm --filter @hrkit/demo dev
```

## Build for production

```bash
pnpm --filter @hrkit/demo build
# → dist/ ready to deploy to any static host
```
