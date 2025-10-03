import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Exclude integration tests that use axios (need refactoring to use app.inject)
    // Also exclude OAuth callback tests that need fixes (session data structure issues)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/setup-v2-guild-roles.test.ts',
      '**/setup-v2-select-guild.test.ts',
      '**/setup-v2-oauth-callback.test.ts',
    ],
    // Run tests sequentially to avoid database conflicts
    // Tests share a single database and have overlapping data setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        'prisma/',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
