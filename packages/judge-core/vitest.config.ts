import { defineConfig } from 'vitest/config';

// The end-to-end tests compile and run real C++.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 } });
