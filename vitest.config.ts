import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['eslint-rules/**/*.test.ts', 'lib/**/*.test.ts', '__fixtures__/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
