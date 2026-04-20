# @hrkit examples

Runnable, copy-pasteable examples that exercise the public SDK surface.
Every file in this folder is executed in CI to guarantee it stays in sync
with the API.

## Run

```bash
pnpm install
pnpm --filter @hrkit/examples quickstart
```

## Index

| File | What it shows |
|------|---------------|
| `quickstart.ts` | Scan → connect → stream HR → record session via `MockTransport`. |

## Adding an example

1. Drop a new `*.ts` file in this folder.
2. Make sure it runs to completion in &lt; 10 seconds with `tsx`.
3. Add a script entry in `package.json` and a row in the table above.
