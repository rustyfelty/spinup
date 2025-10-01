# SpinUp Testing Guide

Quick guide to running the automated test suite for SpinUp.

## Prerequisites

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Start Infrastructure**
   ```bash
   # Start PostgreSQL and Redis (if using Docker)
   docker-compose up -d postgres redis
   ```

3. **Setup Database**
   ```bash
   # Push schema to database
   pnpm db:push
   ```

## Running Tests

### Quick Start - Run All Tests

```bash
pnpm test
```

This runs both API unit tests and E2E tests.

### API Unit Tests Only

```bash
# Run once
pnpm test:api

# Watch mode (re-runs on file changes)
pnpm test:api:watch

# With coverage report
pnpm test:api:coverage
```

Coverage report will be generated in `/apps/api/coverage/`

### E2E Tests Only

```bash
# Headless mode (default)
pnpm test:e2e

# Interactive UI mode (recommended for debugging)
pnpm test:e2e:ui

# Headed mode (see browser)
pnpm test:e2e:headed

# View HTML report
pnpm test:report
```

## Test Structure

```
SpinUp/
├── apps/api/src/__tests__/       # API unit tests
│   ├── routes/
│   │   ├── servers.test.ts       # Server CRUD endpoints
│   │   ├── sso.test.ts           # Authentication
│   │   └── config.test.ts        # Configuration management
│   ├── workers/
│   │   └── jobs.test.ts          # Job queue operations
│   └── setup.ts                  # Test utilities
├── tests/e2e/                    # End-to-end tests
│   ├── authentication.spec.ts    # Login/logout flows
│   ├── server-lifecycle.spec.ts  # Server creation/management
│   └── console-logs.spec.ts      # Console log viewing
└── TEST_REPORT.md               # Comprehensive test documentation
```

## What's Tested

### ✅ API Routes (80 tests)
- Server CRUD operations
- Job enqueuing (CREATE, START, STOP, DELETE)
- SSO authentication (Discord & dev mode)
- Configuration management (Minecraft)
- Input validation
- Error handling

### ✅ Worker Jobs (20 tests)
- Job creation in database
- Job lifecycle management
- Status transitions
- Error tracking

### ✅ E2E User Flows (32 tests)
- Authentication (login, logout, session)
- Server creation wizard
- Server status transitions
- Start/stop operations
- Console log viewing
- Configuration editing
- Search and filtering

## Test Environment

Tests use the development database by default. To use a separate test database:

```bash
# Set test database URL
export DATABASE_URL_TEST="postgresql://user:pass@localhost:5433/spinup_test"

# Run tests
pnpm test
```

## Known Issues

1. **ARM64 Compatibility**: Some Docker images don't support Apple Silicon
   - Tests verify job enqueuing, not container success
   - Run full E2E on x86_64 for complete testing

2. **Timing**: Server operations can be slow
   - Image pulls: 30-60 seconds first time
   - Tests include appropriate waits
   - Some tests may timeout on slow connections

3. **Docker Required**: E2E tests need Docker daemon running
   - Worker tests check job enqueuing
   - Actual container operations tested in E2E

## Debugging Tests

### API Tests

```bash
# Run specific test file
pnpm --filter @spinup/api test servers.test.ts

# Run with verbose output
pnpm --filter @spinup/api test -- --reporter=verbose

# Debug in VS Code
# Add breakpoint and use "Debug Test" CodeLens
```

### E2E Tests

```bash
# Run specific test file
pnpm test:e2e authentication.spec.ts

# Run in UI mode (best for debugging)
pnpm test:e2e:ui

# Run with headed browser
pnpm test:e2e:headed

# Generate trace for failed test
# Traces are saved in test-results/
```

## Viewing Test Reports

### API Coverage Report

After running `pnpm test:api:coverage`:
```bash
open apps/api/coverage/index.html
```

### E2E Test Report

After running `pnpm test:e2e`:
```bash
pnpm test:report
# Opens HTML report in browser
```

## Writing New Tests

### API Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { yourRoutes } from '../../routes/your-routes';
import { createTestOrg, cleanupTestOrg } from '../setup';

describe('Your Routes', () => {
  const app = Fastify();
  let testOrgId: string;

  beforeAll(async () => {
    await app.register(yourRoutes, { prefix: '/api/your-route' });
    await app.ready();

    const org = await createTestOrg('your-test');
    testOrgId = org.id;
  });

  afterAll(async () => {
    await cleanupTestOrg(testOrgId);
    await app.close();
  });

  it('should do something', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/your-route',
    });

    expect(response.statusCode).toBe(200);
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Your Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByRole('button', { name: /quick dev login/i }).click();
    await page.waitForURL(/\//);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/your-page');

    await expect(page.getByText('Expected Text')).toBeVisible();
  });
});
```

## CI/CD Integration

Recommended GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup database
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/spinup_test

      - name: Run API tests
        run: pnpm test:api

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            apps/api/coverage/
            test-results/
            playwright-report/
```

## Troubleshooting

### "Database connection failed"
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Run `pnpm db:push`

### "Redis connection refused"
- Ensure Redis is running on port 6379
- Check if another service is using the port

### "Timeout waiting for server"
- Ensure API/Web servers are not already running on ports 8080/5173
- Kill existing processes: `lsof -ti:8080 | xargs kill`

### "Docker socket error"
- Ensure Docker daemon is running
- Check Docker Desktop is started

### "Playwright browser not found"
- Install browsers: `pnpm exec playwright install`

## Performance

**Test Execution Times** (approximate):
- API Tests: 30 seconds
- E2E Tests: 3-5 minutes
- Total: ~5-6 minutes

**Optimization Tips**:
- Run API tests first (fail fast)
- Use `--bail` flag to stop on first failure
- Run E2E tests in parallel (requires test isolation)
- Cache Playwright browsers in CI

## Support

For issues or questions:
1. Check TEST_REPORT.md for detailed documentation
2. Review test logs and error messages
3. Enable debug mode: `DEBUG=* pnpm test`
4. Check existing test examples

## Summary

- ✅ 112 total tests covering critical functionality
- ✅ 75-80% estimated code coverage
- ✅ Fast feedback (30s for API tests)
- ✅ Comprehensive E2E coverage
- ✅ Easy to run and maintain

Happy testing! 🧪
