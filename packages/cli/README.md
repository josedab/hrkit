# @hrkit/cli

Command-line tools for [@hrkit](https://github.com/josedab/hrkit) — simulate workouts as a streaming HR source, package GATT captures into conformance fixtures, and sign / verify bundles with ECDSA P-256.

## Install

```bash
npm install -g @hrkit/cli
# or one-shot
npx @hrkit/cli help
```

## Commands

### `hrkit simulate`

Boot a tiny HTTP server that streams a synthetic HR profile derived from a Workout DSL file. Useful for app development without a sensor and for end-to-end demos in CI.

```bash
hrkit simulate --workout warmup.dsl --max-hr 190 --rate 4 --port 8080
```

| Endpoint | Description |
|----------|-------------|
| `GET /health` | `{ ok, samples }` |
| `GET /profile.json` | Full computed HR profile |
| `GET /stream` | Server-Sent Events with `{ hr, t, packet }` per tick |

Use `--rate N` to fast-forward time (e.g., `--rate 4` runs four-times speed).

### `hrkit submit-fixture`

Build a conformance-corpus fixture from a JSONL capture (each line: `{ at_ms, bytes_hex }`).

```bash
hrkit submit-fixture \
  --device "Polar H10" \
  --service 180D --characteristic 2A37 \
  --capture capture.jsonl \
  --out fixture.json
```

### `hrkit keygen` / `hrkit sign` / `hrkit verify`

Sign and verify conformance bundles with ECDSA P-256 (Web Crypto). Keys are exported as JWK JSON files so they round-trip across browsers, Node, Deno, and Bun.

```bash
hrkit keygen --out-private private.json --out-public public.json
hrkit sign --in fixture.json --key private.json --signer "alice@example" --out signed.json
hrkit verify --in signed.json --public-key public.json
```

`verify` exits non-zero on signature failure — wire it into CI to gate corpus PRs.

### `hrkit help`

Print the full command list.

## Programmatic API

The package also re-exports the helpers backing the CLI so you can build your own tools:

```ts
import {
  buildConformanceFixture,
  dslToHrProfile,
  encodeHrPacket,
  parseArgv,
  workoutToHrProfile,
} from '@hrkit/cli';

const profile = dslToHrProfile(`warmup 5m z1\nz3 20m\ncooldown 5m z1`, { maxHR: 190 });
// profile: HrTimePoint[] — { t, hr } per second
```

| Symbol | Description |
|--------|-------------|
| `dslToHrProfile(dsl, { maxHR? })` | Parse Workout DSL → `HrTimePoint[]`. |
| `workoutToHrProfile(protocol, { maxHR? })` | Same but starting from an already-parsed `WorkoutProtocol`. |
| `encodeHrPacket(hr, rr?)` | GATT-spec heart-rate measurement bytes. |
| `buildConformanceFixture(opts)` | Build a fixture JSON object from capture metadata. |
| `parseArgv(argv)` | Tiny argv parser used by the binary; exported for test reuse. |

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/cli/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
