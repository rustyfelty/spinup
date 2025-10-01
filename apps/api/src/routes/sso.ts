import { FastifyPluginCallback } from "fastify";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { prisma } from "../services/prisma";
import { magicLinkIssueSchema } from "@spinup/shared";

const JWT_SECRET = process.env.API_JWT_SECRET || "devsecret123456789";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "supersecretservicetoken";

export const ssoRoutes: FastifyPluginCallback = (app, _opts, done) => {
  // Issue magic link (called by Discord bot)
  app.post("/discord/issue", async (req, reply) => {
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
  app.get("/discord/consume", async (req, reply) => {
    const { token } = req.query as { token?: string };

    if (!token) {
      return reply.redirect("/login?error=missing-token");
    }

    try {
      // Verify JWT
      const payload = jwt.verify(token, JWT_SECRET) as any;

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

      // Set session cookie - no sameSite in dev for cross-port compatibility
      const cookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      };
      if (process.env.NODE_ENV === "production") {
        cookieOptions.sameSite = "lax";
      }
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

      const userId = (req.user as any).sub;
      const orgId = (req.user as any).org;

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

      return reply.send({
        user: {
          id: user.id,
          discordId: user.discordId,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        },
        org: user.memberships[0]?.org,
        role: user.memberships[0]?.role
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
    app.post("/dev/login", async (req, reply) => {
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

        // Set session cookie - no sameSite in dev for cross-port compatibility
        const cookieOptions: any = {
          httpOnly: true,
          secure: false,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        // Don't set sameSite in development to allow cross-port requests
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

    app.get("/dev/login", async (req, reply) => {
      // HTML page for easy dev login
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SpinUp Dev Login</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .card {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
              max-width: 400px;
              width: 100%;
              text-align: center;
            }
            h1 {
              margin: 0 0 0.5rem 0;
              color: #1a202c;
            }
            p {
              color: #4a5568;
              margin: 0 0 2rem 0;
            }
            button {
              background: #667eea;
              color: white;
              border: none;
              padding: 0.75rem 2rem;
              border-radius: 0.5rem;
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              width: 100%;
            }
            button:hover {
              background: #5a67d8;
              transform: translateY(-1px);
            }
            .warning {
              background: #fef2c7;
              border: 1px solid #f6e05e;
              border-radius: 0.5rem;
              padding: 0.75rem;
              margin-top: 1.5rem;
              color: #744210;
              font-size: 0.875rem;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>SpinUp Dev Login</h1>
            <p>Quick login for development mode</p>
            <button onclick="login()">Login as Dev User</button>
            <div class="warning">
              ⚠️ Development mode only. In production, use Discord authentication.
            </div>
          </div>
          <script>
            async function login() {
              try {
                const response = await fetch('/api/sso/dev/login', {
                  method: 'POST',
                  credentials: 'include'
                });
                const data = await response.json();
                if (data.success) {
                  const webOrigin = '${process.env.WEB_ORIGIN || "http://localhost:5173"}';
                  window.location.href = webOrigin + '/orgs/' + data.org.id + '/servers';
                }
              } catch (error) {
                alert('Login failed: ' + error);
              }
            }
          </script>
        </body>
        </html>
      `;

      reply.type('text/html').send(html);
    });
  }

  done();
};