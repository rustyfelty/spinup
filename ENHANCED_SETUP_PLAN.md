# Enhanced Setup/Onboarding Flow - Implementation Plan

**Status:** Database Schema ✅ Complete | Implementation ⏳ In Progress  
**Date:** 2025-10-02

---

## Overview

This document outlines the implementation plan for an enhanced Discord-integrated setup and onboarding flow for SpinUp. The goal is to eliminate manual configuration and provide a seamless, guided experience.

##  What's Been Completed

### ✅ Database Schema Updates (DONE)

**New Models:**
1. **`OrgSettings`** - Per-organization configuration
   - Role mappings (Discord role IDs → SpinUp roles)
   - Feature flags (AI enabled, max servers, max backups)
   - Default server settings (memory, CPU)

2. **`SetupState`** - Setup progress tracking
   - Step completion flags
   - Selected guild info
   - Installer user tracking
   - Onboarding status

3. **`Org` Model Enhanced** - Additional Discord fields
   - `discordGuildId` - Proper Discord guild ID
   - `discordGuildName` - Guild name from Discord
   - `discordIconHash` - Guild icon
   - `discordOwnerDiscordId` - Guild owner ID
   - `lastSyncAt` - Last Discord sync timestamp
   - `settings` relation to OrgSettings

**Migration Status:**
- Schema pushed to database successfully
- Prisma Client regenerated
- No data loss (new fields are nullable/optional)
- Backwards compatible with existing `discordGuild` field

---

## Implementation Roadmap

### Phase 1: Backend API (Priority: HIGH)

#### 1.1 Setup Status & Validation Endpoints
**Files to Create:**
- `/var/www/spinup/apps/api/src/routes/setup-v2.ts`

**Endpoints:**
```typescript
GET  /api/setup/status          // Returns setup state, next step
POST /api/setup/discord/validate // Validates Discord bot credentials
POST /api/setup/discord/test    // Tests Discord bot connection
```

**Implementation:**
- Check `SetupState` record
- Validate bot token with Discord API
- Return current progress + next step

#### 1.2 Discord OAuth Integration
**Files to Create:**
- `/var/www/spinup/apps/api/src/services/discord-oauth.ts`

**Endpoints:**
```typescript
GET  /api/setup/discord/auth-url  // Generate OAuth URL with state
GET  /api/setup/discord/callback  // Handle OAuth callback
GET  /api/setup/discord/guilds    // Fetch user's guilds (requires OAuth token)
```

**Implementation:**
- OAuth state validation (CSRF protection)
- Exchange code for access token
- Fetch guilds from Discord API
- Filter guilds where user is owner/admin
- Store OAuth token temporarily in session/SetupState

#### 1.3 Guild Selection & Role Fetching
**Files to Create:**
- `/var/www/spinup/apps/api/src/services/discord-api.ts`

**Endpoints:**
```typescript
POST /api/setup/select-guild     // Select guild, fetch details
GET  /api/setup/guild/:id/roles  // Get guild roles from Discord
POST /api/setup/guild/:id/check-bot // Check if bot is in guild
```

**Implementation:**
- Fetch guild details from Discord
- Get guild roles with positions
- Check bot membership
- Return guild info + roles list

#### 1.4 Role Configuration
**Endpoints:**
```typescript
POST /api/setup/configure-roles   // Save role mappings
GET  /api/setup/role-mappings     // Get current mappings
```

**Implementation:**
- Validate Discord role IDs exist in guild
- Save to `OrgSettings` table
- Support multiple Discord roles per SpinUp role
- Set installer as OWNER automatically

#### 1.5 Setup Completion
**Endpoints:**
```typescript
POST /api/setup/complete          // Finalize setup, create org
GET  /api/setup/health            // Verify all services
```

**Implementation:**
- Generate secrets (if not exists)
- Write/update `.env` file
- Create `Org` record with Discord data
- Create `OrgSettings` with role mappings
- Sync initial members from Discord
- Create installer's `Membership` as OWNER
- Mark `SetupState` as complete
- Trigger first Discord sync

---

### Phase 2: Discord Sync Service (Priority: HIGH)

#### 2.1 Member Sync Logic
**Files to Create:**
- `/var/www/spinup/apps/api/src/services/discord-sync.ts`

**Functions:**
```typescript
async syncGuildMembers(guildId: string, orgId: string)
async determineMemberRole(memberRoles: string[], roleMapping: OrgSettings)
async upsertMembership(userId, orgId, role)
async cleanupRemovedMembers(orgId, currentMembers)
```

**Logic:**
1. Fetch all guild members from Discord
2. For each member, check their Discord roles
3. Determine SpinUp role based on `OrgSettings` mappings
4. Highest matching role wins (OWNER > ADMIN > OPERATOR > VIEWER)
5. Upsert `Membership` record
6. Remove memberships for users no longer in guild
7. Log sync stats to audit table

#### 2.2 Settings/Admin Endpoints
**Files to Update:**
- `/var/www/spinup/apps/api/src/routes/settings.ts`

**New Endpoints:**
```typescript
GET  /api/settings/roles          // Get current role mappings (ADMIN+)
PUT  /api/settings/roles          // Update role mappings (OWNER only)
POST /api/settings/sync-discord   // Trigger manual sync (ADMIN+)
GET  /api/settings/sync-status    // Get last sync info
GET  /api/settings/discord/roles  // Fetch fresh roles from Discord
```

**Permissions:**
- Read role mappings: ADMIN, OWNER
- Update role mappings: OWNER only
- Trigger sync: ADMIN, OWNER
- Prevent self-demotion (can't remove your own OWNER role)

#### 2.3 Background Sync Job
**Files to Create:**
- `/var/www/spinup/apps/api/src/workers/discord-sync.worker.ts`

**Implementation:**
- Cron job every 15 minutes
- Sync all orgs with Discord
- Log sync stats
- Alert on failures
- Update `Org.lastSyncAt`

---

### Phase 3: Frontend Setup Flow (Priority: MEDIUM)

#### 3.1 Setup Pages
**Files to Create:**
1. `/var/www/spinup/apps/web/src/pages/setup/Welcome.tsx`
2. `/var/www/spinup/apps/web/src/pages/setup/Discord.tsx`
3. `/var/www/spinup/apps/web/src/pages/setup/GuildSelect.tsx`
4. `/var/www/spinup/apps/web/src/pages/setup/Roles.tsx`
5. `/var/www/spinup/apps/web/src/pages/setup/System.tsx`
6. `/var/www/spinup/apps/web/src/pages/setup/Review.tsx`
7. `/var/www/spinup/apps/web/src/pages/setup/Complete.tsx`

**Component Hierarchy:**
```
SetupWizard (layout wrapper)
├── SetupProgress (step indicator)
├── Welcome
├── Discord (bot config)
│   └── DiscordBotTest (connection test)
├── GuildSelect
│   └── GuildCard (displays each guild)
├── Roles
│   └── RoleMappingEditor (drag-drop or multi-select)
├── System (domains, DB, etc)
├── Review (summary)
└── Complete (success + redirect)
```

**Features:**
- Step navigation (back/next)
- Progress persistence (resume setup)
- Validation on each step
- Loading states
- Error handling
- Mobile responsive

#### 3.2 Reusable Components
**Files to Create:**
```
/components/setup/
  ├── SetupProgress.tsx       // Step indicator
  ├── SetupCard.tsx           // Card wrapper
  ├── GuildCard.tsx           // Guild display
  ├── RoleMappingEditor.tsx   // Role configuration UI
  └── SetupNavigation.tsx     // Back/Next buttons
```

**Design System:**
- Use existing Tailwind theme
- Purple/indigo gradient
- Clear typography
- Iconography (lucide-react)
- Smooth transitions

---

### Phase 4: Settings/Admin UI (Priority: MEDIUM)

#### 4.1 Settings Pages
**Files to Create:**
1. `/var/www/spinup/apps/web/src/pages/settings/Roles.tsx`
2. `/var/www/spinup/apps/web/src/pages/settings/Discord.tsx`
3. `/var/www/spinup/apps/web/src/pages/settings/General.tsx`

**Features:**
- Role mapping editor (same component from setup)
- Discord sync status widget
- Manual "Sync Now" button
- Last sync timestamp
- Sync history/logs
- Discord bot status indicator

#### 4.2 Admin Dashboard Widgets
**Files to Update:**
- `/var/www/spinup/apps/web/src/pages/Dashboard.tsx`

**New Widgets:**
- Discord connection status
- Last sync time
- Member count
- Quick sync button (for admins)

---

### Phase 5: Onboarding Flow (Priority: LOW)

#### 5.1 First-Time User Experience
**Files to Create:**
- `/var/www/spinup/apps/web/src/pages/Onboarding.tsx`

**Steps:**
1. Welcome message
2. Quick stats (0 servers, 0 backups)
3. Interactive checklist:
   - Create first server (guided)
   - Explore AI assistant
   - Set up backups
   - Invite team members
4. Dismissible tour overlays
5. Mark onboarding complete

**Implementation:**
- Check `SetupState.onboardingComplete`
- Show once per user
- Allow skip/dismiss
- Track progress in local storage

---

## API Integration Points

### Discord API Calls

```typescript
// OAuth
GET  https://discord.com/api/oauth2/authorize
POST https://discord.com/api/oauth2/token

// User data
GET /users/@me
GET /users/@me/guilds

// Guild data
GET /guilds/{guild.id}
GET /guilds/{guild.id}/roles
GET /guilds/{guild.id}/members?limit=1000
GET /guilds/{guild.id}/members/{user.id}
```

### Required Discord Permissions

**Bot Permissions:**
- View Channels
- Send Messages
- Manage Server (for role sync)
- Read Message History

**OAuth Scopes:**
- `identify` - Get user info
- `guilds` - List user's guilds
- `guilds.members.read` - Read guild members

---

## Security Considerations

### 1. OAuth State Validation
```typescript
// Generate cryptographically random state
const state = randomBytes(32).toString('hex');
// Store in session with expiry
await redis.setex(`oauth:state:${state}`, 300, userId);
// Validate on callback
const valid = await redis.get(`oauth:state:${state}`);
```

### 2. Bot Token Storage
- Store in `.env` (not database)
- Never expose in API responses
- Use environment variables only
- Consider encryption at rest

### 3. Rate Limiting
- Setup endpoints: 5 req/min per IP
- OAuth callback: 10 req/min per IP
- Discord API: Respect Discord's rate limits
- Sync endpoints: 1 req/5min per org

### 4. Permission Escalation Prevention
```typescript
// Can't grant yourself higher permissions
if (newRole > currentUserRole) {
  throw new Error('Cannot grant higher role than your own');
}

// OWNER-only operations
if (action === 'UPDATE_ROLES' && userRole !== 'OWNER') {
  throw new Error('Only OWNER can update role mappings');
}
```

### 5. Audit Logging
Log all setup & role changes:
- Who made the change
- What was changed
- When it happened
- IP address
- Previous/new values

---

## Testing Strategy

### Backend Tests
```typescript
// Setup endpoints
describe('POST /api/setup/discord/validate', () => {
  it('validates bot token');
  it('rejects invalid token');
  it('checks bot is online');
});

// Role sync
describe('syncGuildMembers', () => {
  it('syncs members with correct roles');
  it('handles removed members');
  it('respects role hierarchy');
  it('handles multiple Discord roles');
});
```

### Frontend Tests
```typescript
// Setup wizard
describe('SetupWizard', () => {
  it('navigates through steps');
  it('validates each step');
  it('persists progress');
  it('completes setup');
});
```

### Integration Tests
```typescript
// End-to-end setup
describe('Complete Setup Flow', () => {
  it('goes from welcome to complete');
  it('creates org and syncs members');
  it('redirects to dashboard');
});
```

---

## Implementation Timeline

### Week 1: Backend Foundation
- [x] Database schema updates
- [ ] Setup status endpoints
- [ ] Discord OAuth integration
- [ ] Guild selection logic
- [ ] Role mapping storage

### Week 2: Sync Service
- [ ] Discord sync service
- [ ] Background worker
- [ ] Settings/admin endpoints
- [ ] Permission checks
- [ ] Audit logging

### Week 3: Frontend Setup
- [ ] Setup wizard pages
- [ ] Guild selection UI
- [ ] Role mapping editor
- [ ] System configuration
- [ ] Review & completion

### Week 4: Settings & Polish
- [ ] Settings pages
- [ ] Discord sync UI
- [ ] Dashboard widgets
- [ ] Onboarding flow
- [ ] Documentation

---

## Next Steps

**Immediate (Phase 1):**
1. Create `setup-v2.ts` route file
2. Implement Discord OAuth flow
3. Build guild fetching logic
4. Create setup wizard frontend structure

**Then (Phase 2):**
5. Implement Discord sync service
6. Create background worker
7. Add settings endpoints
8. Build role mapping editor UI

**Future Enhancements:**
- Webhook support for real-time Discord events
- Multi-guild support (multiple orgs per instance)
- Custom permission policies
- RBAC beyond Discord roles
- Integration with other platforms (Telegram, Slack, etc.)

---

## Resources

**Discord API Docs:**
- OAuth2: https://discord.com/developers/docs/topics/oauth2
- Guild API: https://discord.com/developers/docs/resources/guild
- User API: https://discord.com/developers/docs/resources/user

**Prisma Docs:**
- Relations: https://www.prisma.io/docs/concepts/components/prisma-schema/relations
- Arrays: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#-modifier

**React Router:**
- Nested Routes: https://reactrouter.com/en/main/start/overview
- Protected Routes: https://reactrouter.com/en/main/start/examples

