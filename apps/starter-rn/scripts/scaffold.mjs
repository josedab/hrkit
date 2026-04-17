#!/usr/bin/env node
/**
 * Scaffold helper for @hrkit/starter-rn.
 * Copies src/ into a target Expo project so users don't need to remember the cp invocation.
 *
 * Usage: pnpm scaffold ../path/to/my-expo-app
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];

if (!target) {
  console.error('Usage: pnpm scaffold <target-app-directory>');
  console.error('Example: pnpm scaffold ../my-hrkit-app');
  process.exit(1);
}

const targetDir = resolve(process.cwd(), target);
if (!existsSync(targetDir)) {
  console.error(`Target directory does not exist: ${targetDir}`);
  console.error('Create it first with: npx create-expo-app@latest <name> --template blank-typescript');
  process.exit(1);
}

const srcDir = resolve(__dirname, '..', 'src');
const dstDir = join(targetDir, 'src');
if (existsSync(dstDir)) {
  console.error(`Refusing to overwrite existing directory: ${dstDir}`);
  console.error('Move or remove it first, then re-run.');
  process.exit(1);
}

mkdirSync(dstDir, { recursive: true });
cpSync(srcDir, dstDir, { recursive: true });

console.log(`✓ Copied @hrkit/starter-rn template to ${dstDir}`);
console.log('');
console.log('Next steps:');
console.log('  1. cd ' + targetDir);
console.log('  2. npx expo install react-native-ble-plx expo-dev-client');
console.log('  3. npm install @hrkit/core @hrkit/react-native');
console.log('  4. Update App.tsx: export { default } from "./src/App";');
console.log('  5. Add BLE permissions to app.json (see starter-rn README).');
console.log('  6. npx expo run:ios   # or run:android');
