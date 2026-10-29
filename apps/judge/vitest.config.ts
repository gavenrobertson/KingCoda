import { defineConfig } from 'vitest/config';

// The judge flow runs against Miniflare's D1 and R2 and compiles real C++ with the local g++.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 120_000 } });
