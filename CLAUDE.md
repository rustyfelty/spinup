# SpinUp Development Guidelines

## CRITICAL: Port Management and Server Restarts

### Always Kill Old Processes Before Starting Dev Servers

The dev servers (API and Web) MUST run on specific ports that match the Caddy reverse proxy configuration:
- **API**: MUST run on port 8080
- **Web**: MUST run on port 5173

**IMPORTANT**: When restarting dev servers, ALWAYS use the clean restart script:

```bash
cd /var/www/spinup
./clean-restart.sh
```

This script automatically:
- Kills all old dev processes (concurrently, tsx, vite)
- Force-kills processes holding ports 8080 and 5173
- Verifies NODE_ENV is set to development
- Starts dev servers on the correct ports

**Manual cleanup** (if script doesn't work):
```bash
# Kill all dev processes
pkill -9 -f "concurrently.*dev"
pkill -9 -f "tsx watch"
pkill -9 -f "vite"

# Force kill processes on specific ports
kill -9 $(lsof -t -i:8080) 2>/dev/null || true
kill -9 $(lsof -t -i:5173) 2>/dev/null || true

# Start fresh
cd /var/www/spinup
pnpm dev
```

### Why This Matters

1. **Port conflicts**: If old processes hold ports 8080 or 5173, new instances will bind to alternative ports (5174, 5175, etc.)
2. **502 errors**: Caddy is configured to proxy to specific ports. If the app runs on a different port, you'll get 502 Bad Gateway
3. **Stale code**: Old processes may run outdated code with `NODE_ENV=production` or old environment variables
4. **Mixed state**: Multiple processes can cause database conflicts and confusing behavior

### Before Every Development Session

**Use the clean restart script:**
```bash
cd /var/www/spinup
./clean-restart.sh
```

**To verify servers are running correctly:**
```bash
# Check ports
lsof -i :8080  # Should show node (API)
lsof -i :5173  # Should show node (Vite)

# Test API
curl http://localhost:8080/api/system/health

# Test Web (should return HTML)
curl http://localhost:5173/
```

### Caddy Configuration (DO NOT CHANGE)

The Caddy reverse proxy at `/etc/caddy/Caddyfile` is configured for:
- Web frontend: `localhost:5173` → `https://daboyz.live`
- API backend: `localhost:8080` → `https://daboyz.live/api/*`

If you change these ports, you MUST update the Caddyfile and reload Caddy:
```bash
sudo systemctl reload caddy
```

## Troubleshooting Checklist

When debugging issues, ALWAYS follow this checklist from basic to complex:

### 1. **Basic Building Blocks**
- [ ] Is the route added to the router? (Check App.tsx for frontend routes)
- [ ] Are all imports present and correct?
- [ ] Are variable names spelled correctly?
- [ ] Are environment variables set?
- [ ] Are types/interfaces properly defined?

### 2. **API Issues**
- [ ] Is the API server running? (Check port 8080)
- [ ] Is the endpoint registered in the routes file?
- [ ] Is middleware applied correctly (preHandler)?
- [ ] Are request/response types correct?
- [ ] Check API logs for detailed errors

### 3. **Frontend Issues**
- [ ] Is the frontend dev server running? (Check port 5173)
- [ ] Are React components rendering? (Check browser console)
- [ ] Is the route defined in App.tsx?
- [ ] Are axios/fetch calls using correct credentials?
- [ ] Check Network tab for request/response details

### 4. **Authentication Issues**
- [ ] Is the spinup_sess cookie being set? (Check Application → Cookies in DevTools)
- [ ] Is withCredentials: true set on axios?
- [ ] Is credentials: 'include' set on fetch calls?
- [ ] Are CORS settings correct (origin + credentials)?
- [ ] Check cookie sameSite settings for development

### 5. **Database Issues**
- [ ] Are migrations up to date? (pnpm db:push)
- [ ] Does the data exist in the database?
- [ ] Are Prisma types generated?
- [ ] Check database logs for query errors

## After Every Change

### 1. **Manual Verification**
- Check that dev servers reloaded without errors
- Check browser console for JavaScript errors
- Check API logs for runtime errors
- Verify the specific change you made is visible

### 2. **Automated Testing**
Run Playwright tests to verify functionality:
```bash
node test-auth-flow.mjs
```

### 3. **What to Test**
- Can you log in? (Dev Login button works)
- Can you navigate to the feature you changed?
- Does the feature work as expected?
- Are there any console errors or 401/500 responses?

## Architecture Notes

### Cookie-Based Authentication
- **Dev Login**: POST to `/api/sso/dev/login` from frontend
- **Cookie Name**: `spinup_sess`
- **Cookie Settings (Dev)**: httpOnly, secure=false, NO sameSite (for cross-port)
- **JWT Secret**: From `API_JWT_SECRET` env var
- **Token Payload**: `{ sub: userId, org: orgId }`

### Middleware
- `authenticate()`: Verifies JWT token exists
- `authorizeServer()`: Verifies user owns the server
- `authorizeOrgAccess()`: Verifies user belongs to the org

### API Structure
- **Port**: 8080
- **CORS Origin**: http://localhost:5173 (frontend)
- **Routes**: Registered in `src/routes/*.ts`
- **Middleware**: Applied via `preHandler` option

### Frontend Structure
- **Port**: 5173
- **Router**: React Router v6 in App.tsx
- **API Client**: Axios with `withCredentials: true`
- **State Management**: React Query (TanStack Query)

## Common Issues & Solutions

### 401 Unauthorized
1. Check cookie is being sent (Network tab → Headers → Cookie)
2. Verify token is valid (not expired)
3. Check middleware is applied to the route
4. Verify user has access to the resource

### Route Not Found
1. Check route is registered in App.tsx (frontend) or routes file (backend)
2. Verify URL path matches exactly
3. Check for typos in path parameters

### Cookie Not Sent
1. Ensure login request originates from http://localhost:5173
2. Verify `withCredentials: true` on axios
3. Verify `credentials: 'include'` on fetch
4. Check CORS settings allow credentials
5. In dev, ensure sameSite is NOT set (or set to compatible value)

### React Not Rendering
1. Check browser console for errors
2. Verify all imports are correct
3. Check for syntax errors in JSX
4. Ensure dev server reloaded after changes
