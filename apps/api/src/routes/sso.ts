import { FastifyPluginCallback } from "fastify";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";
import { prisma } from "../services/prisma";
import { magicLinkIssueSchema } from "@spinup/shared";
import { discordOAuth } from "../services/discord-oauth";

// Validate secrets at module load time
const JWT_SECRET = process.env.API_JWT_SECRET;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("API_JWT_SECRET must be set and at least 32 characters long");
}

if (!SERVICE_TOKEN || SERVICE_TOKEN.length < 32) {
  throw new Error("SERVICE_TOKEN must be set and at least 32 characters long");
}

// In-memory store for OAuth states (CSRF protection only)
// Shared between login and setup flows
const oauthStates = new Map<string, { expiresAt: number; flow?: 'login' | 'setup' }>();

// Export for use in setup routes
export { oauthStates };

export const ssoRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Issue magic link (called by Discord bot)
  app.post("/discord/issue", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute"
      }
    }
  }, async (req, reply) => {
    // Validate service token
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${SERVICE_TOKEN}`) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    // Validate request body
    const result = magicLinkIssueSchema.safeParse(req.body);
    if (!result.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: result.error.flatten()
      });
    }

    const { discordUserId, discordGuildId, displayName, avatarUrl } = result.data;

    try {
      // Upsert organization from Discord guild
      const org = await prisma.org.upsert({
        where: { discordGuild: discordGuildId },
        update: {
          name: `Guild ${discordGuildId}` // Could be updated with actual guild name
        },
        create: {
          discordGuild: discordGuildId,
          name: `Guild ${discordGuildId}`
        }
      });

      // Upsert user from Discord user
      const user = await prisma.user.upsert({
        where: { discordId: discordUserId },
        update: {
          displayName: displayName || discordUserId,
          avatarUrl: avatarUrl
        },
        create: {
          discordId: discordUserId,
          displayName: displayName || discordUserId,
          avatarUrl: avatarUrl
        }
      });

      // Ensure membership exists
      const existingMembership = await prisma.membership.findFirst({
        where: {
          userId: user.id,
          orgId: org.id
        }
      });

      if (!existingMembership) {
        await prisma.membership.create({
          data: {
            userId: user.id,
            orgId: org.id,
            role: "OPERATOR" // Default role for new members
          }
        });
      }

      // Create magic link token
      const jti = randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.loginToken.create({
        data: {
          jti,
          userId: user.id,
          orgId: org.id,
          expiresAt
        }
      });

      // Generate JWT
      const token = jwt.sign(
        {
          sub: user.id,
          org_id: org.id,
          jti
        },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      // Build magic link URL
      const webOrigin = process.env.WEB_ORIGIN || "http://localhost:5173";
      const magicUrl = `${webOrigin}/sso/discord/consume?token=${encodeURIComponent(token)}`;

      return reply.send({ magicUrl });

    } catch (error) {
      app.log.error("Failed to issue magic link:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Consume magic link (called by web app)
  app.get("/discord/consume", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute"
      }
    }
  }, async (req, reply) => {
    const { token } = req.query as { token?: string };

    if (!token) {
      return reply.redirect("/login?error=missing-token");
    }

    try {
      // Verify JWT
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; org_id: string; jti: string };

      // Check if token has been used
      const loginToken = await prisma.loginToken.findUnique({
        where: { jti: payload.jti }
      });

      if (!loginToken) {
        return reply.redirect("/login?error=invalid-token");
      }

      if (loginToken.usedAt) {
        return reply.redirect("/login?error=token-already-used");
      }

      if (loginToken.expiresAt < new Date()) {
        return reply.redirect("/login?error=token-expired");
      }

      // Mark token as used
      await prisma.loginToken.update({
        where: { jti: payload.jti },
        data: { usedAt: new Date() }
      });

      // Create session JWT
      const sessionToken = jwt.sign(
        {
          sub: payload.sub,
          org: payload.org_id
        },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      // Set session cookie with secure options
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: (process.env.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
        signed: true
      };
      reply.setCookie("spinup_sess", sessionToken, cookieOptions);

      // Redirect to dashboard
      return reply.redirect(`/orgs/${payload.org_id}/servers`);

    } catch (error: any) {
      app.log.error("Failed to consume magic link:", error);

      if (error.name === "TokenExpiredError") {
        return reply.redirect("/login?error=token-expired");
      }

      if (error.name === "JsonWebTokenError") {
        return reply.redirect("/login?error=invalid-token");
      }

      return reply.redirect("/login?error=auth-failed");
    }
  });

  // Get current user (for authenticated requests)
  app.get("/me", async (req, reply) => {
    try {
      // This will use the JWT from the cookie (configured in index.ts)
      await req.jwtVerify();

      const userId = req.user?.sub;
      const orgId = req.user?.org;

      if (!userId || !orgId) {
        return reply.code(401).send({ error: "Invalid authentication token" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          memberships: {
            where: { orgId },
            include: {
              org: true
            }
          }
        }
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const membership = user.memberships[0];
      const org = membership?.org;
      const isDiscordOwner = org?.discordOwnerDiscordId === user.discordId;

      return reply.send({
        user: {
          id: user.id,
          discordId: user.discordId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        },
        org,
        role: membership?.role,
        isDiscordOwner
      });

    } catch (error) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // Logout
  app.post("/logout", async (req, reply) => {
    reply.clearCookie("spinup_sess", { path: "/" });
    return reply.send({ success: true });
  });

  // Development-only login (no Discord required)
  if (process.env.NODE_ENV !== "production") {
    app.post("/dev/login", {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    }, async (req, reply) => {
      try {
        // Create or get dev org
        const org = await prisma.org.upsert({
          where: { discordGuild: "dev-org" },
          update: {},
          create: {
            discordGuild: "dev-org",
            name: "Development Organization"
          }
        });

        // Create or get dev user
        const user = await prisma.user.upsert({
          where: { discordId: "dev-user" },
          update: {},
          create: {
            discordId: "dev-user",
            displayName: "Dev User",
            avatarUrl: null
          }
        });

        // Ensure membership
        const existingMembership = await prisma.membership.findFirst({
          where: {
            userId: user.id,
            orgId: org.id
          }
        });

        if (!existingMembership) {
          await prisma.membership.create({
            data: {
              userId: user.id,
              orgId: org.id,
              role: "OWNER"
            }
          });
        }

        // Create session JWT
        const sessionToken = jwt.sign(
          {
            sub: user.id,
            org: org.id
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        // Set session cookie with secure options (dev mode has relaxed settings)
        const cookieOptions = {
          httpOnly: true,
          secure: false,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          sameSite: "lax" as const,
          signed: true
        };
        reply.setCookie("spinup_sess", sessionToken, cookieOptions);

        return reply.send({
          success: true,
          user: {
            id: user.id,
            displayName: user.displayName
          },
          org: {
            id: org.id,
            name: org.name
          },
          message: "Development login successful"
        });
      } catch (error) {
        app.log.error("Dev login failed:", error);
        return reply.code(500).send({ error: "Failed to create dev session" });
      }
    });
  }

  // Discord OAuth Login (for regular user login, not setup)
  app.get("/discord/oauth/login", async (req, reply) => {
    try {
      // Check if this is a retry (after prompt=none failed)
      const retry = req.query.retry === 'true';

      // Generate CSRF state token with flow type encoded
      const state = randomBytes(32).toString('hex');
      oauthStates.set(state, {
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        flow: 'login' // Mark this as login flow
      });

      // Use unified callback route (backend handles full OAuth flow)
      const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
      const redirectUri = `${apiOrigin}/api/sso/discord/login/callback`;

      const { url } = discordOAuth.generateAuthUrl(state, {
        redirectUri,
        includeBot: false, // Don't include bot scope for regular login
        skipPrompt: false  // Always show auth screen to avoid loops with 2FA
      });

      return reply.send({ url });
    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate Discord OAuth URL'
      });
    }
  });

  // Unified OAuth callback handler for both login and setup flows
  app.get("/discord/login/callback", async (req, reply) => {
    const { code, state, guild_id, error: oauthError } = req.query as { code?: string; state?: string; guild_id?: string; error?: string };
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';

    // Handle OAuth errors (e.g., when prompt=none fails because user hasn't authorized)
    if (oauthError && state) {
      const stateData = oauthStates.get(state);
      app.log.info(`OAuth error received: ${oauthError}`);

      // Handle various OAuth errors that require re-authorization
      if (stateData && (oauthError === 'consent_required' || oauthError === 'interaction_required' || oauthError === 'login_required')) {
        // User hasn't authorized the app yet or needs to re-authenticate (2FA, etc.)
        oauthStates.delete(state);
        app.log.info(`${oauthError} error, retrying with full consent screen`);

        // Redirect back to login endpoint with retry flag
        const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
        const retryUrl = `${apiOrigin}/api/sso/discord/oauth/login?retry=true`;

        // Return HTML that auto-redirects (preserves the OAuth flow)
        return reply.type('text/html').send(`
          <!DOCTYPE html>
          <html>
          <head><meta http-equiv="refresh" content="0;url=${retryUrl}"></head>
          <body>Redirecting to Discord authorization...</body>
          </html>
        `);
      }

      // For other OAuth errors, log and redirect with error
      app.log.error(`Unhandled OAuth error: ${oauthError}`);
      return reply.redirect(`${webOrigin}/login?error=oauth-failed&details=${oauthError}`);
    }

    if (!code || !state) {
      return reply.redirect(`${webOrigin}/login?error=missing-params`);
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return reply.redirect(`${webOrigin}/login?error=invalid-state`);
    }

    if (stateData.expiresAt < Date.now()) {
      oauthStates.delete(state);
      return reply.redirect(`${webOrigin}/login?error=state-expired`);
    }

    // Check if this is a setup flow or login flow
    const isSetupFlow = stateData.flow === 'setup';

    try {
      const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
      const redirectUri = `${apiOrigin}/api/sso/discord/login/callback`;

      // Exchange code for access token
      const tokenData = await discordOAuth.exchangeCode(code, redirectUri);

      // Get user info
      const discordUser = await discordOAuth.getUser(tokenData.access_token);

      // Clean up OAuth state
      oauthStates.delete(state);

      if (isSetupFlow) {
        // SETUP FLOW: Create OAuth session and redirect to setup wizard
        const { oauthSessionManager } = await import('../services/oauth-session-manager');

        // Create session using session manager
        const session = await oauthSessionManager.createSession({
          userId: discordUser.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in
        });

        app.log.info('[Setup Flow] Created OAuth session for user:', discordUser.id);

        // Mark OAuth as configured in SetupState
        // If guild_id was provided (from bot authorization), also mark guild as selected
        const updateData: any = {
          oauthConfigured: true
        };

        if (guild_id) {
          updateData.guildSelected = true;
          updateData.selectedGuildId = guild_id;
          updateData.installerDiscordId = discordUser.id;
        }

        await prisma.setupState.upsert({
          where: { id: 'singleton' },
          create: {
            id: 'singleton',
            ...updateData
          },
          update: updateData
        });

        // Redirect to setup wizard with session token
        const redirectUrl = new URL(`${webOrigin}/setup-wizard`);
        redirectUrl.searchParams.set('sessionToken', session.sessionToken);
        if (guild_id) {
          redirectUrl.searchParams.set('guildId', guild_id);
        }
        redirectUrl.searchParams.set('userId', discordUser.id);
        redirectUrl.searchParams.set('username', discordUser.username);

        return reply.redirect(redirectUrl.toString());

      } else {
        // LOGIN FLOW: Find or create user and create JWT session
        let user = await prisma.user.findUnique({
          where: { discordId: discordUser.id },
          include: {
            memberships: {
              include: {
                org: true
              }
            }
          }
        });

        // If user doesn't exist, create them and add to the default org
        if (!user) {
          const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null;

          // Find the first org in the system (or create a default one)
          let defaultOrg = await prisma.org.findFirst({
            where: {
              discordGuildId: { not: null }
            },
            include: {
              settings: {
                include: {
                  rolePermissions: true
                }
              }
            }
          });

          if (!defaultOrg) {
            // Create a default org if none exists
            defaultOrg = await prisma.org.create({
              data: {
                name: 'Default Organization'
              }
            });
          }

          // Determine the user's role based on Discord roles
          let assignedRole: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'OPERATOR'; // Default to OPERATOR

          // If org has Discord integration, fetch user's roles and match permissions
          if (defaultOrg.discordGuildId && defaultOrg.settings?.discordRolePermissions) {
            try {
              // Get user's guild member info to see their roles (requires bot token)
              const botToken = process.env.DISCORD_BOT_TOKEN;
              if (!botToken) {
                throw new Error('Discord bot token not configured');
              }
              const guildMember = await discordOAuth.getGuildMember(defaultOrg.discordGuildId, discordUser.id, botToken);

              // Check if user is the Discord server owner
              if (defaultOrg.discordOwnerDiscordId === discordUser.id) {
                assignedRole = 'OWNER';
              } else {
                // Find the highest permission role they have
                const rolePermissions = defaultOrg.settings.discordRolePermissions;
                const userHasAdminRole = guildMember.roles.some((roleId: string) =>
                  rolePermissions.some(rp => rp.discordRoleId === roleId && rp.canManageSettings)
                );

                if (userHasAdminRole) {
                  assignedRole = 'ADMIN';
                }
                // OPERATOR is already the default
              }
            } catch (roleError) {
              app.log.warn(`Failed to fetch Discord roles for user ${discordUser.id}:`, roleError);
              // Keep default OPERATOR role
            }
          }

          // Create the user with a membership to the default org
          user = await prisma.user.create({
            data: {
              discordId: discordUser.id,
              displayName: discordUser.global_name || discordUser.username,
              avatarUrl: avatarUrl,
              memberships: {
                create: {
                  role: assignedRole,
                  orgId: defaultOrg.id
                }
              }
            },
            include: {
              memberships: {
                include: {
                  org: true
                }
              }
            }
          });

          app.log.info(`Created new user ${user.id} (${discordUser.username}) with role ${assignedRole} and added to org ${defaultOrg.id}`);
        }

        if (user.memberships.length === 0) {
          return reply.redirect(`${webOrigin}/login?error=no-access`);
        }

        // Update user profile with latest Discord info
        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null;

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            displayName: discordUser.global_name || discordUser.username,
            avatarUrl: avatarUrl
          },
          include: {
            memberships: {
              include: {
                org: true
              }
            }
          }
        });

        // Get first membership's org
        const membership = user.memberships[0];
        const org = membership.org;

        // Create session JWT
        const sessionToken = app.jwt.sign(
          {
            sub: user.id,
            org: org.id
          },
          { expiresIn: '1d' }
        );

        // Set session cookie
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 1 day
          sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
          signed: true
        };

        reply.setCookie('spinup_sess', sessionToken, cookieOptions);

        // Redirect to dashboard (frontend)
        return reply.redirect(`${webOrigin}/orgs/${org.id}/servers`);
      }
    } catch (error: any) {
      app.log.error({
        error: error.message || error,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status
      }, 'Discord OAuth callback error');

      if (isSetupFlow) {
        return reply.redirect(`${webOrigin}/setup?error=oauth-failed`);
      } else {
        return reply.redirect(`${webOrigin}/login?error=oauth-failed`);
      }
    }
  });

  // Legacy callback endpoint - kept for backwards compatibility
  // Redirects to the unified callback handler
  app.get("/discord/oauth/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };

    // Redirect to the unified callback handler
    const apiOrigin = process.env.API_ORIGIN || 'http://localhost:8080';
    const params = new URLSearchParams();
    if (code) params.set('code', code);
    if (state) params.set('state', state);

    const redirectUrl = `${apiOrigin}/api/sso/discord/login/callback?${params.toString()}`;
    return reply.redirect(redirectUrl);
  });

  done();
};