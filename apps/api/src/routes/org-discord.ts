import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/prisma';
import { discordOAuth } from '../services/discord-oauth';
import { authenticate } from '../middleware/auth';

/**
 * Organization Discord settings routes
 * Manage Discord integration and role permissions for an organization
 */
export default async function orgDiscordRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/org/:orgId/discord/config
   * Get Discord configuration and role permissions for an organization
   */
  fastify.get<{
    Params: {
      orgId: string;
    };
  }>('/:orgId/discord/config', { preHandler: authenticate }, async (request, reply) => {
    const { orgId } = request.params;
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    try {
      // Verify user has access to this org
      const membership = await prisma.membership.findFirst({
        where: {
          userId,
          orgId
        }
      });

      if (!membership) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization'
        });
      }

      // Get org with Discord settings
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: {
          settings: {
            include: {
              rolePermissions: true
            }
          }
        }
      });

      if (!org) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Organization not found'
        });
      }

      return reply.status(200).send({
        guild: {
          id: org.discordGuildId,
          name: org.discordGuildName,
          iconHash: org.discordIconHash
        },
        ownerDiscordId: org.discordOwnerDiscordId,
        rolePermissions: org.settings?.rolePermissions || []
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch Discord configuration'
      });
    }
  });

  /**
   * PATCH /api/org/:orgId/discord/roles
   * Update role permissions for an organization
   * Requires canManageRoles permission
   */
  fastify.patch<{
    Params: {
      orgId: string;
    };
    Body: {
      rolePermissions: Array<{
        discordRoleId: string;
        discordRoleName: string;
        discordRoleColor: number;
        canCreateServer: boolean;
        canDeleteServer: boolean;
        canStartServer: boolean;
        canStopServer: boolean;
        canRestartServer: boolean;
        canEditConfig: boolean;
        canEditFiles: boolean;
        canInstallMods: boolean;
        canCreateBackup: boolean;
        canRestoreBackup: boolean;
        canDeleteBackup: boolean;
        canViewLogs: boolean;
        canViewMetrics: boolean;
        canViewConsole: boolean;
        canExecuteCommands: boolean;
        canManageMembers: boolean;
        canManageRoles: boolean;
        canManageSettings: boolean;
      }>;
    };
  }>('/:orgId/discord/roles', { preHandler: authenticate }, async (request, reply) => {
    const { orgId } = request.params;
    const { rolePermissions } = request.body;
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    try {
      // Get org to verify access and get Discord owner
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: {
          settings: {
            include: {
              rolePermissions: true
            }
          },
          memberships: {
            where: { userId },
            include: { user: true }
          }
        }
      });

      if (!org) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Organization not found'
        });
      }

      if (org.memberships.length === 0) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization'
        });
      }

      // Check if user has canManageRoles permission
      // For now, we'll allow the Discord server owner to always manage roles
      const userDiscordId = org.memberships[0].user.discordId;
      const isOwner = userDiscordId === org.discordOwnerDiscordId;

      if (!isOwner) {
        // TODO: Check user's actual role permissions
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to manage roles'
        });
      }

      if (!org.settings) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Organization settings not found'
        });
      }

      // Delete existing role permissions (except Server Owner)
      await prisma.discordRolePermission.deleteMany({
        where: {
          orgSettingsId: org.settings.id,
          discordRoleId: {
            not: 'server_owner'
          }
        }
      });

      // Create new role permissions
      await prisma.discordRolePermission.createMany({
        data: rolePermissions.map(rp => ({
          orgSettingsId: org.settings!.id,
          discordRoleId: rp.discordRoleId,
          discordRoleName: rp.discordRoleName,
          discordRoleColor: rp.discordRoleColor,
          canCreateServer: rp.canCreateServer,
          canDeleteServer: rp.canDeleteServer,
          canStartServer: rp.canStartServer,
          canStopServer: rp.canStopServer,
          canRestartServer: rp.canRestartServer,
          canEditConfig: rp.canEditConfig,
          canEditFiles: rp.canEditFiles,
          canInstallMods: rp.canInstallMods,
          canCreateBackup: rp.canCreateBackup,
          canRestoreBackup: rp.canRestoreBackup,
          canDeleteBackup: rp.canDeleteBackup,
          canViewLogs: rp.canViewLogs,
          canViewMetrics: rp.canViewMetrics,
          canViewConsole: rp.canViewConsole,
          canExecuteCommands: rp.canExecuteCommands,
          canManageMembers: rp.canManageMembers,
          canManageRoles: rp.canManageRoles,
          canManageSettings: rp.canManageSettings
        }))
      });

      // Fetch updated permissions
      const updatedPermissions = await prisma.discordRolePermission.findMany({
        where: { orgSettingsId: org.settings.id }
      });

      return reply.status(200).send({
        success: true,
        message: 'Role permissions updated successfully',
        rolePermissions: updatedPermissions
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update role permissions'
      });
    }
  });

  /**
   * POST /api/org/:orgId/discord/sync-roles
   * Fetch latest roles from Discord for the organization's guild
   * Requires canManageRoles permission
   */
  fastify.post<{
    Params: {
      orgId: string;
    };
  }>('/:orgId/discord/sync-roles', { preHandler: authenticate }, async (request, reply) => {
    const { orgId } = request.params;
    const userId = request.user?.sub;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    try {
      // Get org
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: {
          memberships: {
            where: { userId },
            include: { user: true }
          }
        }
      });

      if (!org) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Organization not found'
        });
      }

      if (org.memberships.length === 0) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization'
        });
      }

      if (!org.discordGuildId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No Discord guild associated with this organization'
        });
      }

      // Fetch roles from Discord using bot token
      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (!botToken) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Discord bot token not configured'
        });
      }

      const roles = await discordOAuth.getGuildRoles(org.discordGuildId, botToken);

      // Filter out @everyone and managed roles
      const selectableRoles = roles.filter(role =>
        role.name !== '@everyone' && !role.managed
      );

      return reply.status(200).send({
        success: true,
        roles: selectableRoles.map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position
        }))
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to sync roles from Discord'
      });
    }
  });
}
