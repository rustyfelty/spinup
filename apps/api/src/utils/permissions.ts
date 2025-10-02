import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Check if a user is the Discord server owner for an organization
 */
export async function isServerOwner(userDiscordId: string, orgId: string): Promise<boolean> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { discordOwnerDiscordId: true }
  });

  return org?.discordOwnerDiscordId === userDiscordId;
}

/**
 * Get all permissions for a user in an organization
 * Server owners automatically get all permissions via the special "Server Owner" role
 */
export async function getUserPermissions(userDiscordId: string, orgId: string): Promise<{
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
  isOwner: boolean;
}> {
  // Check if user is server owner first
  const ownerCheck = await isServerOwner(userDiscordId, orgId);

  if (ownerCheck) {
    // Server owner has all permissions
    return {
      canCreateServer: true,
      canDeleteServer: true,
      canStartServer: true,
      canStopServer: true,
      canRestartServer: true,
      canEditConfig: true,
      canEditFiles: true,
      canInstallMods: true,
      canCreateBackup: true,
      canRestoreBackup: true,
      canDeleteBackup: true,
      canViewLogs: true,
      canViewMetrics: true,
      canViewConsole: true,
      canExecuteCommands: true,
      canManageMembers: true,
      canManageRoles: true,
      canManageSettings: true,
      isOwner: true
    };
  }

  // Get user's Discord roles and find matching role permissions
  // This will be implemented when you have Discord role syncing
  // For now, return minimal permissions
  return {
    canCreateServer: false,
    canDeleteServer: false,
    canStartServer: false,
    canStopServer: false,
    canRestartServer: false,
    canEditConfig: false,
    canEditFiles: false,
    canInstallMods: false,
    canCreateBackup: false,
    canRestoreBackup: false,
    canDeleteBackup: false,
    canViewLogs: true,
    canViewMetrics: true,
    canViewConsole: false,
    canExecuteCommands: false,
    canManageMembers: false,
    canManageRoles: false,
    canManageSettings: false,
    isOwner: false
  };
}
