import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // All test files share one real Postgres database and each empties every
    // table in `beforeEach` (see items.test.ts, analytics.test.ts). Running
    // files in parallel races those truncations against each other, so keep
    // files sequential; tests within a file still run in order already.
    fileParallelism: false,
  },
});
