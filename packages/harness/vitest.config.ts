import { defineConfig } from 'vitest/config';

// Driver tests compile and run real programs, so give them room.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 } });
