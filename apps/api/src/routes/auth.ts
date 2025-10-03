import { FastifyPluginCallback } from 'fastify';
import { prisma } from '../services/prisma';
import { discordOAuth } from '../services/discord-oauth';
import { oauthSessionManager } from '../services/oauth-session-manager';
import { oauthStates } from './sso';

export const authRoutes: FastifyPluginCallback = (app, _opts, done) => {
  /**
   * GET /api/auth/discord/callback
   * Unified Discord OAuth callback handler for both login and setup flows
   */
  app.get('/discord/callback', async (request, reply) => {
    const { code, state, guild_id } = request.query as { code?: string; state?: string; guild_id?: string };

    if (!code || !state) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing code or state parameter'
      });
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid or expired state token'
      });
    }

    if (stateData.expiresAt < Date.now()) {
      oauthStates.delete(state);
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'State token expired'
      });
    }

    // Check if this is a login flow
    if (stateData.flow === 'login') {
      try {
        // Exchange code for access token
        const tokenData = await discordOAuth.exchangeCode(code);

        // Get user info
        const discordUser = await discordOAuth.getUser(tokenData.access_token);

        // Find user by Discord ID
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

        if (!user || user.memberships.length === 0) {
          return reply.redirect('/login?error=no-access');
        }

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
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
          signed: true
        };

        reply.setCookie('spinup_sess', sessionToken, cookieOptions);

        // Clean up OAuth state
        oauthStates.delete(state);

        // Redirect to dashboard
        return reply.redirect(`/orgs/${org.id}/servers`);
      } catch (error: any) {
        app.log.error('Discord OAuth login error:', error);
        return reply.redirect('/login?error=oauth-failed');
      }
    }

    // This is a setup flow
    try {
      // Exchange code for access token
      const tokenData = await discordOAuth.exchangeCode(code);

      // Get user info
      const user = await discordOAuth.getUser(tokenData.access_token);

      // Create session using session manager
      const session = await oauthSessionManager.createSession({
        userId: user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });

      // Mark OAuth as configured in SetupState
      // If guild_id was provided (from bot authorization), also mark guild as selected
      const updateData: any = {
        oauthConfigured: true
      };

      if (guild_id) {
        updateData.guildSelected = true;
        updateData.selectedGuildId = guild_id;
        updateData.installerDiscordId = user.id;
      }

      await prisma.setupState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          ...updateData
        },
        update: updateData
      });

      // Clean up OAuth state
      oauthStates.delete(state);

      return reply.status(200).send({
        success: true,
        sessionToken: session.sessionToken,
        guildId: guild_id || null,
        user: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar
        }
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  done();
};
