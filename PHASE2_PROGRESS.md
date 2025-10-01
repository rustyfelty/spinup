# SpinUp Phase 2: Generic Container System - Progress Report

## Summary

We've successfully completed **Phase 1** (adding 6 new games + fixing port mapping) and started **Phase 2** (generic container system). The foundation is in place with database schema, Docker images, and documentation.

---

## ✅ Phase 1 Complete

### Achievements
1. **Fixed 1:1 Port Mapping** - Eliminated Factorio pingpong warnings
2. **Fixed Auth Bug** - Changed `request.server` to `request.authorizedServer`
3. **Added 6 New Games**:
   - Team Fortress 2 🎯
   - Squad 🪖
   - Mordhau 🗡️
   - Don't Starve Together 🌙
   - Starbound 🚀
   - V Rising 🧛

### Impact
- Game library: **12 → 18 games (50% increase)**
- Server detail pages now work correctly
- Port conflicts resolved

---

## 🚧 Phase 2: In Progress (Foundation Complete)

### What's Done
1. ✅ **Database Schema** - CustomScript model added to Prisma
2. ✅ **Docker Images** - Multi-arch base + AMD64 full version
3. ✅ **Security Design** - Non-root execution, resource limits
4. ✅ **Documentation** - Comprehensive README with examples

### What's Next
1. ⏳ **Worker Implementation** - custom-server.worker.ts
2. ⏳ **Script Validation** - Security scanning service
3. ⏳ **UI Wizard** - CustomServerWizard component
4. ⏳ **Prisma Migration** - Apply schema changes
5. ⏳ **End-to-end Testing** - Test with sample script

---

## Architecture

```
User Creates Custom Server
         ↓
Frontend Wizard (React)
    - Upload/paste script
    - Configure ports/env vars
         ↓
Backend API Validates
    - Size check (64KB max)
    - Pattern scan (dangerous commands)
    - SHA-256 hash
         ↓
Store in Database
    - CustomScript model
    - Linked to Server
         ↓
Worker Creates Container
    - Mount script at /startup/server_init.sh
    - Apply security constraints
    - Start container
         ↓
Container Executes Script
    - Downloads game server
    - Configures settings
    - Starts game process
```

---

## Security Model

### Container Isolation
- ✅ Non-root user (UID 1000)
- ✅ No privileged mode
- ✅ Resource limits (2GB RAM, 2 CPU)
- ⏳ TODO: AppArmor/SELinux profiles
- ⏳ TODO: Seccomp filters

### Script Validation
- ⏳ TODO: Size limit enforcement (64KB)
- ⏳ TODO: Dangerous pattern detection:
  ```typescript
  const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\//,           // rm -rf /
    /curl.*\|\s*sh/,            // curl | sh
    /eval\s+/,                  // eval command
    /wget.*\|\s*sh/,            // wget | sh
    /__import__.*os.*system/,   // Python os.system
  ];
  ```
- ⏳ TODO: User confirmation workflow
- ⏳ TODO: Audit logging

---

## Example Scripts

### OpenTTD Server
```bash
#!/bin/bash
set -euo pipefail

cd /data
wget https://cdn.openttd.org/openttd-releases/14.1/openttd-14.1-linux-generic-amd64.tar.xz
tar -xf openttd-14.1-linux-generic-amd64.tar.xz

cat > openttd.cfg <<EOF
[network]
server_port = ${SERVER_PORT:-3979}
EOF

cd openttd-14.1-linux-generic-amd64
exec ./openttd -D -c /data/openttd.cfg
```

### Simple HTTP Server (Testing)
```bash
#!/bin/bash
cd /data
echo "<h1>Hello from SpinUp!</h1>" > index.html
exec python3 -m http.server ${SERVER_PORT:-8080}
```

---

## Git Status

### Branches
- `main` - Phase 1 complete
- `feature/generic-container-system` - Current work

### Recent Commits
```
56dd6e2 feat: Add 6 new game servers and fix port mapping
8883fe8 feat(phase2): Add generic container system foundation
```

---

## Time Estimate

### Remaining Work
| Task | Estimate |
|------|----------|
| Worker implementation | 1-2 hours |
| Validation service | 1 hour |
| UI wizard | 2-3 hours |
| Prisma migration | 15 min |
| Testing | 1 hour |
| **Total** | **5-7 hours** |

---

## Files Created/Modified

### Phase 1
- `packages/shared/src/games.ts` - Added 6 games
- `apps/web/src/pages/Dashboard.tsx` - Added icons
- `apps/api/src/workers/server.worker.ts` - 1:1 port mapping
- `apps/api/src/middleware/auth.ts` - Fixed property name

### Phase 2
- `apps/api/prisma/schema.prisma` - CustomScript model
- `infra/generic-server/Dockerfile` - Multi-arch base
- `infra/generic-server/Dockerfile.amd64` - Full featured
- `infra/generic-server/entrypoint.sh` - Script executor
- `infra/generic-server/README.md` - Documentation

---

## Next Steps

1. **Implement Worker Logic**
   ```typescript
   // apps/api/src/workers/custom-server.worker.ts
   case "CREATE":
     const script = await prisma.customScript.findUnique({
       where: { serverId }
     });
     // Mount script as volume
     // Create container with security constraints
   ```

2. **Add Validation Service**
   ```typescript
   // apps/api/src/services/script-validator.ts
   export async function validateScript(content: string) {
     // Check size, scan patterns, compute hash
   }
   ```

3. **Create UI Wizard**
   ```typescript
   // apps/web/src/components/CustomServerWizard.tsx
   // Steps: Choose type → Upload/paste script → Configure → Review → Create
   ```

4. **Run Migration**
   ```bash
   cd apps/api
   npx prisma migrate dev --name add_custom_script
   ```

---

## Questions to Consider

1. Should custom servers be beta/admin-only initially?
2. Do we integrate Claude API for AI script generation?
3. What's the pricing model (same as regular servers)?
4. Should we create a library of pre-made scripts?
5. Do we need a script marketplace/sharing?

---

## Risk Mitigation

### Identified Risks
- ⚠️ Arbitrary code execution
- ⚠️ Resource exhaustion
- ⚠️ Container escape vulnerabilities

### Planned Mitigations
1. Strict validation before execution
2. Resource limits enforced
3. Clear user warnings
4. Audit logging
5. Rate limiting on custom server creation
6. Manual approval for first-time users (optional)

---

## Success Criteria

Phase 2 will be considered complete when:
- ✅ User can create custom server via UI
- ✅ Script validation catches dangerous patterns
- ✅ Container executes script securely
- ✅ Server starts and is accessible
- ✅ Logs are visible in UI
- ✅ No security incidents in testing
- ✅ Documentation is comprehensive

---

*Generated by Claude Code - 2025-10-01*
