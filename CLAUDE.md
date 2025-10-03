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

---

# Project Structure & API Reference

## Technology Stack

### Backend (apps/api)
- **Framework**: Fastify (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Queue**: BullMQ with Redis
- **Container Management**: Dockerode
- **Authentication**: JWT cookies

### Frontend (apps/web)
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS

### Infrastructure
- **Reverse Proxy**: Caddy (handles HTTPS, routing)
- **Database**: PostgreSQL 16 (Docker: void-postgres-1)
- **Cache/Queue**: Redis (for BullMQ job queue)
- **Container Runtime**: Docker (for game servers)

## Directory Structure

```
/var/www/spinup/
├── apps/
│   ├── api/              # Backend API (Fastify)
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry point
│   │   │   ├── routes/            # API route handlers
│   │   │   │   ├── servers.ts     # Server CRUD
│   │   │   │   ├── files.ts       # File management
│   │   │   │   ├── setup-v2.ts    # Setup wizard
│   │   │   │   ├── sso.ts         # Auth/OAuth
│   │   │   │   └── ...
│   │   │   ├── services/          # Business logic
│   │   │   │   ├── file-manager.ts
│   │   │   │   ├── discord-oauth.ts
│   │   │   │   ├── oauth-session-manager.ts
│   │   │   │   └── prisma.ts
│   │   │   ├── workers/           # Background jobs
│   │   │   │   └── server.worker.ts  # Server lifecycle
│   │   │   └── middleware/        # Auth middleware
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Database schema
│   │   └── __tests__/            # Test suite
│   ├── web/              # Frontend (React + Vite)
│   │   ├── src/
│   │   │   ├── App.tsx           # Router configuration
│   │   │   ├── pages/            # Page components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ServerDetail.tsx
│   │   │   │   ├── Setup.tsx
│   │   │   │   └── setup/        # Setup wizard steps
│   │   │   ├── components/       # Reusable components
│   │   │   └── lib/
│   │   │       └── api.ts        # API client
│   │   └── public/
│   └── bot/              # Discord bot (optional)
├── packages/
│   └── shared/           # Shared types/constants
├── .env                  # Environment variables
└── clean-restart.sh      # Dev server restart script
```

## API Endpoint Reference

### Base URL
- **Development**: `http://localhost:8080`
- **Production**: `https://daboyz.live/api`

### Authentication
All endpoints require JWT cookie authentication unless marked as public.

**Cookie Name**: `spinup_sess`
**Middleware**: `authenticate` (required), `authorizeServer` (for server-specific routes)

### Servers API (`/api/servers`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/servers` | ✓ | List all servers for current org |
| POST | `/api/servers` | ✓ | Create new server |
| GET | `/api/servers/:id` | ✓ | Get server details |
| PATCH | `/api/servers/:id` | ✓ | Update server config |
| DELETE | `/api/servers/:id` | ✓ | Delete server |
| POST | `/api/servers/:id/start` | ✓ | Start server |
| POST | `/api/servers/:id/stop` | ✓ | Stop server |
| POST | `/api/servers/:id/restart` | ✓ | Restart server |
| GET | `/api/servers/:id/status` | ✓ | Get server status |
| GET | `/api/servers/:id/logs` | ✓ | Get server logs (SSE) |
| POST | `/api/servers/:id/command` | ✓ | Execute console command |

### Files API (`/api/files`)

**IMPORTANT**: All file endpoints use `/:serverId/` in the path, NOT query parameters.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/files/:serverId/list` | ✓ | List files (query: `?path=/data`) |
| GET | `/api/files/:serverId/read` | ✓ | Read file content (query: `?path=/file.txt`) |
| PUT | `/api/files/:serverId/edit` | ✓ | Edit file (body: `{path, content}`) |
| DELETE | `/api/files/:serverId/delete` | ✓ | Delete file (body: `{path, confirm: true}`) |
| DELETE | `/api/files/:serverId/delete-batch` | ✓ | Delete multiple files |
| POST | `/api/files/:serverId/upload` | ✓ | Upload file (multipart form) |
| GET | `/api/files/:serverId/download` | ✓ | Download file |
| POST | `/api/files/:serverId/archive` | ✓ | Create archive |
| POST | `/api/files/:serverId/extract` | ✓ | Extract archive |

**Frontend API Client Pattern**:
```typescript
// CORRECT
await api.get(`/api/files/${serverId}/list`, { params: { path: '/data' } })

// INCORRECT (old pattern - don't use)
await api.get('/api/files/list', { params: { serverId, path } })
```

### Setup Wizard API (`/api/setup`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/setup/status` | Public | Get setup completion status |
| POST | `/api/setup/configure-domains` | Public | Configure web/API domains |
| GET | `/api/setup/discord/auth-url` | Public | Get Discord OAuth URL |
| GET | `/api/setup/discord/callback` | Public | OAuth callback handler |
| POST | `/api/setup/discord/guilds` | Session | List user's Discord servers |
| POST | `/api/setup/select-guild` | Public | Select Discord guild |
| GET | `/api/setup/guild/:guildId/roles` | Session | Get guild roles |
| POST | `/api/setup/configure-roles` | Public | Configure role permissions |
| POST | `/api/setup/complete` | Public | Complete setup & create org |
| POST | `/api/setup/reset` | ✓ | Reset setup (requires confirmation) |

**Setup Flow**:
1. Status check → 2. Configure domains → 3. Discord OAuth → 4. Select guild → 5. Configure roles → 6. Complete

**Important**: Setup wizard redirects to dashboard automatically after completion (2 second delay).

### Authentication API (`/api/sso`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/sso/dev/login` | Public | Dev-only instant login |
| POST | `/api/sso/discord/issue` | Service | Issue magic link (bot) |
| GET | `/api/sso/discord/consume` | Public | Consume magic link |
| POST | `/api/sso/logout` | ✓ | Logout current user |

### System API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/system/health` | Public | Health check |
| GET | `/api/system/info` | ✓ | System information |

## Database Schema (Key Models)

### Core Models

**User**
```prisma
model User {
  id           String   @id @default(cuid())
  discordId    String   @unique
  displayName  String
  avatarUrl    String?
  memberships  Membership[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Org** (Organization = Discord Guild)
```prisma
model Org {
  id                    String   @id @default(cuid())
  discordGuildId        String?  @unique
  discordGuildName      String?
  name                  String
  memberships           Membership[]
  servers               Server[]
  settings              OrgSettings?
}
```

**Server**
```prisma
model Server {
  id         String       @id @default(cuid())
  orgId      String
  name       String
  gameKey    String       // e.g., "minecraft", "valheim"
  status     ServerStatus @default(STOPPED)
  ports      Json         // Port mappings
  containerId String?     // Docker container ID
  memoryCap  Int          @default(2048)  // MB
  cpuShares  Int          @default(2048)
  configs    ConfigVersion[]
  jobs       Job[]
}

enum ServerStatus {
  CREATING
  RUNNING
  STOPPED
  ERROR
  DELETING
}
```

**Job** (Background Tasks)
```prisma
model Job {
  id         String    @id @default(cuid())
  serverId   String
  type       JobType
  status     JobStatus @default(PENDING)
  progress   Int       @default(0)
  logs       String    @default("")
  error      String?
  startedAt  DateTime?
  finishedAt DateTime?
}

enum JobType {
  CREATE
  START
  STOP
  DELETE
  RESTART
}
```

**SetupState** (Setup Wizard Progress)
```prisma
model SetupState {
  id                  String   @id @default("singleton")
  systemConfigured    Boolean  @default(false)
  oauthConfigured     Boolean  @default(false)
  guildSelected       Boolean  @default(false)
  rolesConfigured     Boolean  @default(false)
  selectedGuildId     String?
  installerUserId     String?
}
```

### Database Access

```bash
# Via Docker
docker exec void-postgres-1 psql -U spinup -d spinup

# Common queries
docker exec void-postgres-1 psql -U spinup -d spinup -c "SELECT * FROM \"Server\";"
docker exec void-postgres-1 psql -U spinup -d spinup -c "SELECT * FROM \"SetupState\" WHERE id = 'singleton';"
```

## Worker System (Background Jobs)

### Architecture
- **Queue**: BullMQ with Redis
- **Worker**: `apps/api/src/workers/server.worker.ts`
- **Queue Name**: `server-jobs`
- **Concurrency**: 5 jobs simultaneously

### Job Types

**CREATE** - Create new server
1. Create data directory at `/srv/spinup/{serverId}/data`
2. Pull Docker image
3. Generate port mappings (30000-40000 range)
4. Create Docker container with mounts and env vars
5. Update server record with containerId and ports

**START** - Start server
1. Validate data directory exists
2. Check container exists
3. Start Docker container
4. Update status to RUNNING

**STOP** - Stop server
1. Stop Docker container (15 second timeout)
2. Update status to STOPPED

**DELETE** - Delete server
1. Stop container
2. Remove container
3. Delete data directory
4. Delete database record

**RESTART** - Restart server
1. Restart Docker container (15 second timeout)
2. Update status to RUNNING

### Docker Mount Points

**CRITICAL**: Server data is stored at:
- **Root**: `/srv/spinup/` (configured via `DATA_DIR` env var)
- **Server Path**: `/srv/spinup/{serverId}/data`
- **Container Mount**: Mounted to game-specific path (e.g., `/data` for Minecraft)

**Permissions**: Must be readable/writable by root user (worker runs as root)

### Job Monitoring

Jobs are tracked in the `Job` table with real-time status updates:
- **PENDING**: Queued but not started
- **RUNNING**: Currently executing
- **SUCCESS**: Completed successfully
- **FAILED**: Failed with error

## Key Services

### FileManager (`services/file-manager.ts`)
Manages file operations inside Docker containers via `docker exec`.

**Key Methods**:
- `listFiles(containerId, path)` - List directory contents
- `readFile(containerId, path)` - Read file content
- `writeFile(containerId, path, content)` - Write file
- `deleteFile(containerId, path)` - Delete file
- `createDirectory(containerId, path)` - Create directory

**Security**:
- Path traversal prevention (`../` blocked)
- MIME type validation
- File size limits
- Critical file protection (server.jar, etc.)
- Malware scanning (EICAR signature detection)

### DiscordOAuth (`services/discord-oauth.ts`)
Handles Discord OAuth flow and API calls.

**Features**:
- OAuth URL generation
- Code exchange for tokens
- User info retrieval
- Guild list fetching (with admin filter)
- Rate limiting (3 second delay between calls)

**Important**: Rate limiter prevents Discord API 429 errors.

### OAuthSessionManager (`services/oauth-session-manager.ts`)
Manages OAuth sessions during setup wizard.

**Database-backed** (survives server restarts)
**Session Token**: 64-character hex string (32 random bytes)
**Expiration**: Set per Discord OAuth token expiry
**Auto-cleanup**: Every 5 minutes

**Methods**:
- `createSession(params)` - Create new session
- `getSession(token)` - Retrieve session (auto-deletes if expired)
- `updateSession(token, params)` - Refresh tokens
- `deleteSession(token)` - Manual cleanup

## Frontend Architecture

### Routing (`App.tsx`)

```tsx
<Routes>
  <Route path="/setup" element={<Setup />} />
  <Route path="/setup-wizard" element={<Setup />} />  {/* OAuth redirect */}
  <Route path="/login" element={<Login />} />
  <Route path="/login/callback" element={<LoginCallback />} />
  <Route path="/" element={<Dashboard />} />
  <Route path="/orgs/:orgId/servers" element={<Dashboard />} />
  <Route path="/server/:id" element={<ServerDetail />} />
  <Route path="/servers/:id" element={<ServerDetail />} />
</Routes>
```

### API Client (`lib/api.ts`)

**Base Configuration**:
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true  // CRITICAL: Sends cookies
})
```

**Pattern**: Export specialized API objects for each domain:
- `serversApi` - Server CRUD and control
- `filesApi` - File management
- `configApi` - Configuration
- `logsApi` - Log streaming

### State Management

**TanStack Query** (React Query) for server state:
- Automatic caching
- Background refetching
- Optimistic updates
- Loading/error states

**Example**:
```typescript
const { data: servers, isLoading } = useQuery({
  queryKey: ['servers', orgId],
  queryFn: () => serversApi.list(orgId)
})
```

## Recent Fixes & Known Issues

### ✅ Fixed (Oct 2025)

1. **Docker Mount Validation** - Added directory checks before CREATE/START jobs
2. **Setup Wizard Redirect** - Auto-redirects to dashboard after completion (prevents OAuth errors)
3. **OAuth Session Tests** - All 17 tests passing (async/await fixed)
4. **Rate Limit Handling** - User-friendly error messages for Discord API 429s
5. **File API Endpoints** - Fixed path format (`/:serverId/action` instead of query params)
6. **Prisma Schema Mismatch** - Removed non-existent User fields (discordUsername, etc.)
7. **Setup Import Paths** - Fixed all step components importing from correct path

### Known Issues

1. **Test Failures**: 15 tests still failing (mostly mock-related, don't affect production)
2. **Orphaned Jobs**: Test jobs may error on startup (harmless, from previous test runs)
3. **React Router Warnings**: v7 migration warnings (cosmetic, safe to ignore)

### Common Gotchas

1. **File API**: Always use `/:serverId/` in path, not `?serverId=` query param
2. **Setup State**: Tokens expire after 10 minutes (increased from 2 minutes)
3. **OAuth Errors**: If seeing OAuth errors after setup, clear sessionStorage and refresh
4. **Port Conflicts**: Always use `./clean-restart.sh` to avoid 502 errors
5. **Container Logs**: Old test containers may show in logs on startup (ignore)

## Environment Variables

**Critical Variables** (`.env`):
```bash
# Database
DATABASE_URL=postgresql://spinup:spinup@localhost:5432/spinup

# Auth
API_JWT_SECRET=<32+ character secret>
SERVICE_TOKEN=<32+ character secret>

# Discord OAuth
DISCORD_CLIENT_ID=<from Discord developer portal>
DISCORD_CLIENT_SECRET=<from Discord developer portal>
DISCORD_REDIRECT_URI=https://daboyz.live/setup-wizard

# Server
NODE_ENV=development
WEB_ORIGIN=http://localhost:5173
DATA_DIR=/srv/spinup

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Development Workflow

### Starting Development
```bash
cd /var/www/spinup
./clean-restart.sh
```

### Running Tests
```bash
cd /var/www/spinup/apps/api
npm test                    # All tests
npm test path/to/test.ts    # Specific test
```

### Database Management
```bash
# Push schema changes
cd /var/www/spinup/apps/api
pnpm prisma db push

# Generate Prisma client
pnpm prisma generate

# View database
docker exec void-postgres-1 psql -U spinup -d spinup
```

### Debugging

**API Logs**: Check terminal running `pnpm dev`
**Frontend Errors**: Browser DevTools Console
**Network Requests**: Browser DevTools Network tab
**Database Queries**: Prisma logs in API terminal (when enabled)

### Quick Health Check
```bash
# Check servers running
lsof -i :8080 -i :5173

# Test API
curl http://localhost:8080/api/system/health

# Check Caddy
systemctl status caddy

# Check database
docker exec void-postgres-1 pg_isready -U spinup
```

---

## Summary

This is a **game server hosting platform** that allows Discord communities to create and manage containerized game servers through a web UI. The backend uses Fastify + Docker + BullMQ for robust job processing, while the frontend is a modern React SPA with real-time updates via React Query.

**Key Concepts**:
- Each server runs in an isolated Docker container
- Jobs are processed asynchronously by a worker
- Authentication is via JWT cookies + Discord OAuth
- Setup wizard guides initial configuration
- File management is done via docker exec commands
- All server control is exposed via REST API

**Domain**: https://daboyz.live
**Reverse Proxy**: Caddy (handles HTTPS, routes to dev servers)
**Dev Ports**: Web 5173, API 8080
