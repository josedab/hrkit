# @hrkit/starter-web

Minimal **Vite + Web Bluetooth** example for [@hrkit](https://github.com/josedab/hrkit).

Scans for a BLE Heart Rate sensor, connects via `@hrkit/web`, and
displays live HR with `@hrkit/widgets` Web Components.

## Run

```bash
pnpm install            # at the repo root
cd apps/starter-web
pnpm dev
```

Open <http://localhost:5173> in **Chrome, Edge, or another
Chromium-based browser** (Web Bluetooth is not supported in Firefox or
Safari). Web Bluetooth requires a secure context — `localhost` works,
otherwise serve over HTTPS.

## What it shows

- `WebBluetoothTransport` from `@hrkit/web`
- `connectToDevice(transport, GENERIC_HR)` from `@hrkit/core`
- Subscribing to `HRPacket` events
- Wiring packets into `<hrkit-hr-display>` and `<hrkit-hr-chart>` from
  `@hrkit/widgets`

## Use it as a template

Copy the directory, rename in `package.json`, replace `workspace:*`
dependencies with published versions, and drop the alias block in
`vite.config.ts`.
