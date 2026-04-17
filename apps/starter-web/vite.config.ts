import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      // Subpath alias must come first.
      { find: /^@hrkit\/core\/profiles$/, replacement: path.resolve(__dirname, '../../packages/core/src/profiles/index.ts') },
      { find: /^@hrkit\/core$/, replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: /^@hrkit\/web$/, replacement: path.resolve(__dirname, '../../packages/web/src/index.ts') },
      { find: /^@hrkit\/widgets$/, replacement: path.resolve(__dirname, '../../packages/widgets/src/index.ts') },
    ],
  },
  server: {
    port: 5173,
  },
});
