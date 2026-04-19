import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/fit.ts', 'src/providers/index.ts', 'src/testing/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
