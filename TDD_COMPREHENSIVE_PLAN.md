# SpinUp Comprehensive TDD Test Plan

## Executive Summary

This comprehensive Test-Driven Development (TDD) plan addresses critical testing gaps in the SpinUp monorepo project. The current test coverage is estimated at 75-80% with significant gaps in frontend testing, several API routes, authentication flows, and security testing.

### Current State Assessment

**Existing Test Infrastructure:**
- **API Tests:** 80 unit tests covering servers, config, SSO, and workers (1,632 lines)
- **E2E Tests:** 1 basic Playwright test for dashboard login
- **Frontend Tests:** NONE (0% coverage - critical gap)
- **Testing Frameworks:** Vitest (API), Playwright (E2E)

**Untested API Routes:**
- `/api/ai` - AI assistant integration
- `/api/files` - File management operations
- `/api/settings` - User/org settings
- `/api/setup` - Server setup wizard
- `/api/system` - System health and resources

**Identified Issues & Bugs:**
- TODO comments indicating incomplete implementations
- Docker exec stream handling disabled in file-manager
- Missing user context in server creation ("createdBy: system")
- No validation tests for script validator
- No error boundary testing in frontend
- Missing authentication flow edge cases

## Priority 1: Critical Security & Authentication Testing

### 1.1 Authentication & Authorization Test Suite
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/middleware/auth.test.ts
```

**Test Cases:**
- JWT token validation and expiration
- Session persistence across requests
- Cookie security (httpOnly, secure flags)
- CORS configuration with credentials
- Rate limiting on auth endpoints
- Magic link expiration and single-use validation
- Discord OAuth flow integration
- Dev mode authentication bypass
- Multi-org access control
- Role-based permissions (future-proofing)

**Red-Green-Refactor Cycles:**
1. RED: Write failing tests for expired tokens
2. GREEN: Implement token expiration logic
3. REFACTOR: Extract token validation to utility

### 1.2 Authorization Middleware Testing
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/middleware/authorization.test.ts
```

**Test Cases:**
- Server ownership verification
- Organization membership validation
- Cross-org access prevention
- Admin override capabilities
- Resource-level permissions
- Cascading permission checks

## Priority 2: Missing API Route Tests

### 2.1 AI Routes (`/api/ai`)
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/routes/ai.test.ts
```

**Test Coverage Required:**
- Model selection and switching
- Request/response validation
- Token limit enforcement
- Error handling for API failures
- Rate limiting per user
- Context persistence
- Streaming response handling

### 2.2 File Management Routes (`/api/files`)
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/routes/files.test.ts
```

**Critical Test Cases:**
- File upload size limits
- MIME type validation
- Path traversal prevention
- Docker volume mounting
- File permissions in containers
- Concurrent file operations
- Large file handling
- Archive extraction security

### 2.3 System Routes (`/api/system`)
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/routes/system.test.ts
```

**Test Coverage:**
- Resource calculation accuracy
- Docker stats integration
- Health check endpoints
- Performance metrics collection
- Alert threshold validation
- System overload scenarios

### 2.4 Setup Routes (`/api/setup`)
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/routes/setup.test.ts
```

**Test Cases:**
- Wizard state management
- Script validation and sanitization
- Docker image validation
- Port allocation conflicts
- Resource limit enforcement
- Rollback on failure

### 2.5 Settings Routes (`/api/settings`)
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/routes/settings.test.ts
```

**Test Coverage:**
- User preference persistence
- Organization settings hierarchy
- Setting validation and constraints
- Audit logging of changes

## Priority 3: Frontend Component Testing (Critical Gap)

### 3.1 Test Infrastructure Setup
```bash
# Install testing libraries
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom @vitejs/plugin-react
```

### 3.2 Component Test Suites

#### Authentication Components
```typescript
// Location: /var/www/spinup/apps/web/src/components/__tests__/
```
- Login.test.tsx - Form validation, error states
- MagicLinkVerify.test.tsx - Token validation, expiry handling
- DiscordIntegration.test.tsx - OAuth flow, error handling

#### Core UI Components
```typescript
// Location: /var/www/spinup/apps/web/src/components/__tests__/
```
- Dashboard.test.tsx - Data loading, filtering, sorting
- ServerDetail.test.tsx - Status updates, action buttons
- CreateServerWizard.test.tsx - Form validation, step navigation
- FileManager.test.tsx - File operations, upload progress
- CommandPalette.test.tsx - Search, keyboard navigation
- AIAssistant.test.tsx - Message handling, streaming responses

#### Page Components
```typescript
// Location: /var/www/spinup/apps/web/src/pages/__tests__/
```
- Setup.test.tsx - Wizard flow, validation
- Settings.test.tsx - Form updates, preference persistence

### 3.3 Hook Testing
```typescript
// Location: /var/www/spinup/apps/web/src/hooks/__tests__/
```
- useAuth.test.ts - Authentication state management
- useWebSocket.test.ts - Real-time updates
- useQuery.test.ts - Data fetching, caching

## Priority 4: End-to-End Testing Expansion

### 4.1 Critical User Flows
```typescript
// Location: /var/www/spinup/tests/e2e/
```

**Authentication Flows:**
- complete-auth-flow.spec.ts - Login → Dashboard → Logout
- magic-link-flow.spec.ts - Request → Email → Verify → Dashboard
- discord-oauth-flow.spec.ts - Discord login → Authorization → Redirect

**Server Management Flows:**
- server-lifecycle.spec.ts - Create → Configure → Start → Stop → Delete
- server-console.spec.ts - View logs → Execute commands → Download logs
- file-management.spec.ts - Upload → Edit → Download → Delete

**Configuration Flows:**
- game-config.spec.ts - Select game → Configure → Save → Apply
- resource-allocation.spec.ts - Set limits → Monitor usage → Adjust

**Error Scenarios:**
- network-failures.spec.ts - Offline handling, retry logic
- server-crashes.spec.ts - Recovery, alerting, logs
- quota-exceeded.spec.ts - Resource limits, user messaging

### 4.2 Cross-Browser Testing
```javascript
// playwright.config.ts updates
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile', use: { ...devices['iPhone 13'] } },
]
```

## Priority 5: Integration Testing

### 5.1 Database Integration Tests
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/integration/database.test.ts
```
- Transaction rollback scenarios
- Concurrent access patterns
- Migration testing
- Data integrity constraints
- Performance with large datasets

### 5.2 Docker Integration Tests
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/integration/docker.test.ts
```
- Container lifecycle management
- Resource limit enforcement
- Network isolation
- Volume mounting security
- Image pull failures

### 5.3 Queue System Tests
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/integration/bullmq.test.ts
```
- Job retry mechanisms
- Dead letter queue handling
- Concurrent job processing
- Job priority management
- Queue overflow scenarios

## Priority 6: Performance Testing

### 6.1 Load Testing
```yaml
# Location: /var/www/spinup/k6/scenarios/
```
- API endpoint load tests (100+ concurrent users)
- WebSocket connection limits
- File upload stress testing
- Database query performance
- Container creation bottlenecks

### 6.2 Performance Benchmarks
```typescript
// Location: /var/www/spinup/apps/api/src/__tests__/performance/
```
- API response time targets (< 200ms)
- Database query optimization (< 50ms)
- File operation throughput
- Memory leak detection
- CPU usage monitoring

## Test Execution Strategy

### Phase 1: Foundation (Week 1-2)
1. Set up frontend testing infrastructure
2. Implement authentication/authorization tests
3. Create critical API route tests (ai, files, system)
4. Establish CI/CD pipeline with test gates

### Phase 2: Coverage Expansion (Week 3-4)
1. Complete frontend component unit tests
2. Expand E2E test scenarios
3. Implement integration tests
4. Add performance benchmarks

### Phase 3: Advanced Testing (Week 5-6)
1. Security penetration testing
2. Load testing and optimization
3. Chaos engineering tests
4. Documentation and training

## Testing Framework Recommendations

### Current (Keep):
- **Vitest** - Fast, ESM-native, excellent DX for unit tests
- **Playwright** - Robust E2E testing with great debugging

### Add:
- **@testing-library/react** - Component testing best practices
- **MSW (Mock Service Worker)** - API mocking for frontend tests
- **K6** - Load testing and performance benchmarking
- **Jest-Extended** - Additional matchers for better assertions
- **Faker.js** - Test data generation

### Consider:
- **Cypress Component Testing** - Alternative to RTL
- **Stryker** - Mutation testing for test quality
- **SonarQube** - Code quality and security analysis

## Test Quality Metrics

### Coverage Targets:
- **Unit Tests:** 90% line coverage
- **Integration Tests:** 80% feature coverage
- **E2E Tests:** 100% critical path coverage

### Performance Targets:
- Unit test suite: < 30 seconds
- Integration tests: < 2 minutes
- E2E test suite: < 5 minutes
- Total CI pipeline: < 10 minutes

### Quality Gates:
- No test may be skipped without approval
- All PRs must include tests for new features
- Breaking changes require migration tests
- Security changes require penetration tests

## Specific Bugs & Issues to Address

### High Priority Bugs:
1. **Docker Exec Stream Handling** - Currently disabled in file-manager.ts
   - Test: Verify stream handling works correctly
   - Test: Ensure no memory leaks in long-running streams

2. **Missing User Context** - "createdBy: system" hardcoded
   - Test: Verify user ID properly extracted from JWT
   - Test: Audit trail correctly attributes actions

3. **Cookie Security** - Development mode security gaps
   - Test: Verify secure flag in production
   - Test: Validate sameSite settings

4. **Rate Limiting** - Not applied consistently
   - Test: Verify rate limits on all public endpoints
   - Test: Test bypass for authenticated users

### Medium Priority Issues:
1. Command palette TODO items need implementation
2. Directory recursion in file manager not handled
3. Script validator templates incomplete
4. No timeout handling for long-running operations

## Implementation Commands

```bash
# Set up frontend testing
cd /var/www/spinup/apps/web
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/ui jsdom

# Create test structure
mkdir -p src/components/__tests__
mkdir -p src/pages/__tests__
mkdir -p src/hooks/__tests__
mkdir -p src/lib/__tests__

# Run tests with coverage
pnpm test:api:coverage  # API coverage report
pnpm test:web:coverage  # Frontend coverage (after setup)

# Watch mode for TDD
pnpm test:api:watch    # API TDD mode
pnpm test:web:watch    # Frontend TDD mode

# E2E test development
pnpm test:e2e:ui       # Playwright UI mode
```

## Next Immediate Actions

1. **Create missing test files for untested API routes**
2. **Set up React Testing Library for frontend**
3. **Write authentication flow E2E tests**
4. **Implement security test suite**
5. **Create performance benchmarks**
6. **Document test patterns and best practices**

## Test Pattern Library

### API Test Pattern:
```typescript
describe('Route: /api/example', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  describe('GET /api/example/:id', () => {
    it('should return 401 without authentication', async () => {
      // RED: Write failing test
      const res = await app.inject({
        method: 'GET',
        url: '/api/example/123'
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return data with valid auth', async () => {
      // GREEN: Make it pass
      const token = await getTestToken();
      const res = await app.inject({
        method: 'GET',
        url: '/api/example/123',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res.statusCode).toBe(200);
      // REFACTOR: Improve implementation
    });
  });
});
```

### Component Test Pattern:
```typescript
describe('Component: ServerCard', () => {
  it('should display server status', () => {
    // RED: Component doesn't handle status
    const { getByText } = render(
      <ServerCard server={{ status: 'RUNNING' }} />
    );
    expect(getByText('Running')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    // GREEN: Add click handler
    const onClick = vi.fn();
    const { getByRole } = render(
      <ServerCard server={mockServer} onClick={onClick} />
    );
    await userEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(mockServer.id);
  });
});
```

### E2E Test Pattern:
```typescript
test('user can create and manage server', async ({ page }) => {
  // Arrange
  await loginAsTestUser(page);

  // Act - RED: Feature doesn't exist
  await page.goto('/dashboard');
  await page.click('button:has-text("Create Server")');
  await page.fill('[name="serverName"]', 'Test Server');
  await page.selectOption('[name="gameType"]', 'minecraft');
  await page.click('button:has-text("Create")');

  // Assert - GREEN: Implement feature
  await expect(page).toHaveURL(/\/servers\/[a-z0-9-]+/);
  await expect(page.locator('h1')).toContainText('Test Server');

  // REFACTOR: Improve UX, add loading states
});
```

## Monitoring & Reporting

### Test Dashboards:
- Coverage trends over time
- Test execution time tracking
- Flaky test detection
- Failure rate analysis

### Reporting Tools:
- Allure for detailed test reports
- Coverage Istanbul for code coverage
- Lighthouse CI for performance metrics
- OWASP ZAP for security reports

---

This comprehensive TDD plan provides a clear roadmap for achieving robust test coverage across the entire SpinUp application stack, with emphasis on critical security, authentication, and user-facing features.