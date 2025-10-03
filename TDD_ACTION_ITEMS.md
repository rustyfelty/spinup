# SpinUp TDD Implementation - Immediate Action Items

## Critical Bugs Discovered

### 1. Docker Exec Stream Handling (HIGH PRIORITY)
**Location:** `/var/www/spinup/apps/api/src/services/file-manager.ts`
**Issue:** Docker exec stream handling is currently disabled
**Impact:** File operations in containers are broken
**Test Coverage:** Added in `files.test.ts` - Docker exec integration test
**Fix Required:**
```typescript
// Need to properly implement stream handling
const exec = await container.exec({
  Cmd: ['sh', '-c', command],
  AttachStdout: true,
  AttachStderr: true
});
const stream = await exec.start({ hijack: true });
// Properly handle stream reading and cleanup
```

### 2. Missing User Context in Server Creation (MEDIUM PRIORITY)
**Location:** `/var/www/spinup/apps/api/src/routes/servers.ts`, `/var/www/spinup/apps/api/src/routes/config.ts`
**Issue:** "createdBy" field hardcoded as "system" instead of actual user
**Impact:** Audit trail incomplete, ownership tracking broken
**Test Coverage:** Tests verify proper user extraction from JWT
**Fix Required:**
```typescript
// Extract user from JWT context
const userId = request.user?.sub;
const server = await prisma.server.create({
  data: {
    ...serverData,
    createdBy: userId || 'system', // Use actual user ID
  }
});
```

### 3. Cookie Security in Development Mode (HIGH PRIORITY)
**Location:** Authentication flow
**Issue:** Cookie security flags not properly set for development
**Impact:** Session hijacking possible in dev environment
**Test Coverage:** Added in `authentication-flows.spec.ts`
**Fix Required:**
- Ensure httpOnly is always true
- Set secure flag based on environment
- Configure sameSite appropriately

### 4. Rate Limiting Not Consistently Applied (MEDIUM PRIORITY)
**Location:** Various API endpoints
**Issue:** Rate limiting missing on critical endpoints (auth, file upload)
**Impact:** DoS attacks possible, resource exhaustion
**Test Coverage:** Rate limit tests in all route test files
**Fix Required:**
- Apply rate limiting middleware to all public endpoints
- Configure different limits for authenticated vs public

## Frontend Testing Gap (CRITICAL)

### Current State: 0% Frontend Unit Test Coverage

**Immediate Actions Required:**

1. **Install Testing Dependencies:**
```bash
cd /var/www/spinup/apps/web
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/ui jsdom @testing-library/react-hooks
```

2. **Configure Vitest for React:**
```typescript
// /var/www/spinup/apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

3. **Create Test Setup File:**
```typescript
// /var/www/spinup/apps/web/src/test/setup.ts
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

## Untested API Routes (HIGH PRIORITY)

### Routes Without Any Tests:
1. **AI Routes** (`/api/ai/*`) - Test file created, needs implementation
2. **File Management** (`/api/files/*`) - Test file created, needs implementation
3. **System Routes** (`/api/system/*`) - Test file created, needs implementation
4. **Setup Routes** (`/api/setup/*`) - No tests at all
5. **Settings Routes** (`/api/settings/*`) - No tests at all

### Immediate Testing Priorities:
1. Authentication middleware - Full coverage needed
2. File upload security - Path traversal, size limits, MIME validation
3. System health monitoring - Critical for production
4. Rate limiting - Prevent abuse
5. Authorization checks - Verify all endpoints check permissions

## E2E Testing Expansion (MEDIUM PRIORITY)

### Current State:
- Only 1 basic E2E test exists
- Created comprehensive authentication flow tests
- Need server management flow tests

### Required E2E Tests:
1. **Server Lifecycle** - Create → Configure → Start → Stop → Delete
2. **File Management** - Upload → Edit → Download → Delete
3. **Console Access** - View logs → Execute commands
4. **Multi-user Scenarios** - Organization access, permissions
5. **Error Recovery** - Network failures, server crashes

## Performance & Load Testing (MEDIUM PRIORITY)

### Not Implemented:
1. No load testing framework
2. No performance benchmarks
3. No memory leak detection
4. No database query optimization tests

### Recommended Tools:
```bash
# Install K6 for load testing
brew install k6  # or download from k6.io

# Install autocannon for API benchmarking
pnpm add -D autocannon
```

## Security Testing Gaps (HIGH PRIORITY)

### Critical Security Tests Missing:
1. **SQL Injection** - No parameterized query validation
2. **XSS Prevention** - No input sanitization tests
3. **CSRF Protection** - No token validation tests
4. **Path Traversal** - Basic tests added but not comprehensive
5. **Authentication Bypass** - No tests for JWT manipulation
6. **Rate Limiting** - Tests added but not implemented

### Recommended Security Testing:
```bash
# Install OWASP ZAP for security scanning
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:5173

# Install npm audit for dependency scanning
npm audit --audit-level=moderate
```

## Database Testing (LOW PRIORITY)

### Missing Tests:
1. Transaction rollback scenarios
2. Concurrent access handling
3. Migration testing
4. Data integrity constraints

## Quick Wins - Can Be Fixed Immediately

1. **Add `createdBy` field extraction from JWT** - 30 minutes
2. **Enable rate limiting on auth endpoints** - 1 hour
3. **Fix cookie security flags** - 30 minutes
4. **Add basic frontend component tests** - 2 hours per component
5. **Implement health check endpoint** - 1 hour

## Execution Commands

### Run New Tests (Will Fail Initially - TDD)
```bash
# Run API tests including new ones
cd /var/www/spinup
pnpm test:api

# Run specific test file
pnpm --filter @spinup/api vitest run src/__tests__/routes/ai.test.ts

# Run E2E authentication tests
pnpm playwright test tests/e2e/authentication-flows.spec.ts

# Run with UI for debugging
pnpm playwright test --ui tests/e2e/authentication-flows.spec.ts
```

### Coverage Report
```bash
# Generate coverage report
pnpm test:api:coverage

# Open HTML coverage report
open apps/api/coverage/index.html
```

## Priority Matrix

### P0 - Critical (Do Today)
1. Fix Docker exec stream handling
2. Set up frontend testing infrastructure
3. Fix authentication cookie security
4. Add rate limiting to auth endpoints

### P1 - High (This Week)
1. Implement all authentication E2E tests
2. Create tests for untested API routes
3. Fix user context in server creation
4. Add security test suite

### P2 - Medium (Next Sprint)
1. Performance testing setup
2. Load testing implementation
3. Complete frontend component tests
4. Database integration tests

### P3 - Low (Backlog)
1. Mutation testing setup
2. Visual regression testing
3. Accessibility testing
4. Internationalization testing

## Test Metrics Tracking

### Current Metrics:
- **API Test Coverage:** ~40% (need 90%)
- **Frontend Test Coverage:** 0% (need 80%)
- **E2E Test Coverage:** ~10% (need 100% critical paths)
- **Test Execution Time:** ~30 seconds (target: maintain <2 minutes)

### Weekly Targets:
- Week 1: API coverage to 60%, Frontend setup complete
- Week 2: API coverage to 80%, Frontend coverage to 40%
- Week 3: API coverage to 90%, Frontend coverage to 60%
- Week 4: Full coverage achieved, performance tests added

## Team Coordination

### Suggested Agent Collaboration:
1. **Backend-Architect:** Review and implement API test fixes
2. **Frontend-Developer:** Implement React component tests
3. **Security-Auditor:** Review and enhance security tests
4. **Performance-Engineer:** Implement load testing
5. **DevOps-Engineer:** Set up CI/CD with test gates

## Monitoring Test Health

### Daily Checks:
1. Run full test suite before any deployment
2. Monitor test execution time trends
3. Track flaky test occurrences
4. Review coverage reports

### Weekly Reviews:
1. Analyze test failure patterns
2. Update test documentation
3. Refactor slow tests
4. Add tests for new bugs found

---

**Note:** All test files created follow TDD principles - they are designed to fail initially (RED phase). Implementation should make them pass (GREEN phase), followed by refactoring (REFACTOR phase).