import { defineConfig } from 'vitest/config';

// Eigenständiger Prozess nach den Funktionstests, damit deren CPU-Last nicht mitgemessen wird.
export default defineConfig({ test: { include: ['tests/performance.test.ts'], environment: 'node', fileParallelism: false } });
