# Contributing to @hrkit

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone <repo-url>
cd hrkit
pnpm install    # requires pnpm >= 9, Node >= 18
pnpm test       # run all tests
pnpm lint       # type-check all packages
pnpm build      # build all packages
```

## Project Structure

```
packages/
  core/           @hrkit/core — zero-dependency core library
  polar/          @hrkit/polar — Polar PMD protocol utilities
  react-native/   @hrkit/react-native — BLE adapter
  web/            @hrkit/web — BLE adapter
apps/
  bjj/            Reference app (uses MockTransport)
```

## Making Changes

1. **Fork & branch** from `main`.
2. **Write tests first** — tests live alongside source in `packages/*/src/__tests__/`.
3. **Keep core zero-dependency** — no runtime dependencies in `@hrkit/core`.
4. **Run checks** before submitting:
   ```bash
   pnpm test && pnpm lint && pnpm build
   ```
5. **Open a PR** with a clear description of the change.

## Code Style

- TypeScript strict mode throughout.
- Pure functions preferred — no classes unless state is required.
- No `any` types.
- Use `camelCase` for functions, `PascalCase` for classes/types, `SCREAMING_SNAKE_CASE` for constants.

## Adding a Device Profile

To add support for a new BLE HR device, create a `DeviceProfile` object:

```typescript
import { DeviceProfile, GATT_HR_SERVICE_UUID } from '@hrkit/core';

export const MY_DEVICE: DeviceProfile = {
  brand: 'MyBrand',
  model: 'MyModel',
  namePrefix: 'MyDevice',
  capabilities: ['heartRate', 'rrIntervals'],
  serviceUUIDs: [GATT_HR_SERVICE_UUID],
};
```

## Reporting Issues

Please include:
- SDK version and package (`@hrkit/core`, `@hrkit/web`, etc.)
- Platform (browser, React Native, Node.js)
- Steps to reproduce
- Expected vs actual behavior
