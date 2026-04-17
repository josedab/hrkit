# @hrkit/dashboard

Multi-athlete live dashboard. Subscribes to a `@hrkit/server` WebSocket fan-out and renders one `<hrkit-heart-rate>` + `<hrkit-zone-bar>` card per athlete.

```bash
pnpm --filter @hrkit/dashboard dev
# -> open http://localhost:5174
# -> live server: http://localhost:5174/?ws=ws://localhost:8080/stream
```

## Server frame format

Each WS message must be JSON in one of:

```json
{ "athleteId": "A1", "name": "Alice", "hr": 142, "zone": 4, "rmssd": 38.2, "atl": 52.1 }
```

or an array of the above for batch updates. Fields beyond `athleteId` and `hr` are optional.

If no `?ws=` is provided, a local 4-athlete simulator drives the grid so the dashboard works out of the box.
