import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], exclude: ['tests/performance.test.ts'], environment: 'node', setupFiles: ['tests/probe/setup.ts'] } });
