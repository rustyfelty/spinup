import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, authApi } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface RolePermissions {
  [roleId: string]: {
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
  };
}

const permissionGroups = [
  {
    title: 'Server Management',
    borderColor: 'dark:bg-game-primary-700 bg-game-primary-400',
    bgColor: 'dark:bg-game-primary-600 bg-game-primary-500',
    textColor: 'text-white',
    permissions: [
      { key: 'canCreateServer', label: 'Create', description: 'Create new game servers' },
      { key: 'canStartServer', label: 'Start', description: 'Start stopped servers' },
      { key: 'canStopServer', label: 'Stop', description: 'Stop running servers' },
      { key: 'canRestartServer', label: 'Restart', description: 'Restart servers' },
      { key: 'canDeleteServer', label: 'Delete', description: 'Permanently delete servers' }
    ]
  },
  {
    title: 'Configuration',
    borderColor: 'dark:bg-game-primary-800 bg-game-primary-400',
    bgColor: 'dark:bg-game-primary-700 bg-game-primary-500',
    textColor: 'text-white',
    permissions: [
      { key: 'canEditConfig', label: 'Edit Config', description: 'Modify server configs' },
      { key: 'canEditFiles', label: 'Edit Files', description: 'Upload/edit/delete files' },
      { key: 'canInstallMods', label: 'Install Mods', description: 'Add plugins and mods' }
    ]
  },
  {
    title: 'Backups',
    borderColor: 'dark:bg-amber-700 bg-amber-400',
    bgColor: 'dark:bg-amber-600 bg-amber-500',
    textColor: 'text-white',
    permissions: [
      { key: 'canCreateBackup', label: 'Create', description: 'Make server backups' },
      { key: 'canRestoreBackup', label: 'Restore', description: 'Restore from backups' },
      { key: 'canDeleteBackup', label: 'Delete', description: 'Remove backups' }
    ]
  },
  {
    title: 'Monitoring',
    borderColor: 'dark:bg-green-700 bg-green-400',
    bgColor: 'dark:bg-green-600 bg-green-500',
    textColor: 'text-white',
    permissions: [
      { key: 'canViewLogs', label: 'View Logs', description: 'Read server logs' },
      { key: 'canViewMetrics', label: 'View Metrics', description: 'See CPU, RAM, player count' },
      { key: 'canViewConsole', label: 'Console', description: 'View live server console' },
      { key: 'canExecuteCommands', label: 'Commands', description: 'Run console commands' }
    ]
  },
  {
    title: 'Administration',
    borderColor: 'dark:bg-red-700 bg-red-400',
    bgColor: 'dark:bg-red-600 bg-red-500',
    textColor: 'text-white',
    permissions: [
      { key: 'canManageMembers', label: 'Members', description: 'Add/remove team members' },
      { key: 'canManageRoles', label: 'Roles', description: 'Edit role permissions' },
      { key: 'canManageSettings', label: 'Settings', description: 'Change organization settings' }
    ]
  }
];

const defaultPermissions = {
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
  canManageSettings: false
};

export default function DiscordRoleSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [guildName, setGuildName] = useState('');
  const [availableRoles, setAvailableRoles] = useState<DiscordRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Fetch current user and organization
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
  });

  const orgId = authData?.org?.id;

  // Redirect if user doesn't have admin access
  useEffect(() => {
    if (authData && authData.role !== 'OWNER' && authData.role !== 'ADMIN' && !authData.isDiscordOwner) {
      navigate('/');
    }
  }, [authData, navigate]);

  useEffect(() => {
    if (orgId) {
      loadDiscordConfig();
    }
  }, [orgId]);

  const loadDiscordConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // First sync roles from Discord to get the latest
      await syncRolesFromDiscord();

      // Then load existing permissions configuration
      const { data } = await api.get(`/api/org/${orgId}/discord/config`);

      setGuildName(data.guild?.name || '');

      // Build role permissions map from existing config
      const permsMap: RolePermissions = {};
      data.rolePermissions.forEach((rp: any) => {
        if (rp.discordRoleId !== 'server_owner') {
          permsMap[rp.discordRoleId] = {
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
          };
        }
      });

      // Set permissions from database (this takes precedence over synced defaults)
      setRolePermissions(permsMap);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load Discord configuration');
    } finally {
      setLoading(false);
    }
  };

  const syncRolesFromDiscord = async () => {
    const { data } = await api.post(`/api/org/${orgId}/discord/sync-roles`);

    const newRoles = data.roles as DiscordRole[];
    setAvailableRoles(newRoles);

    // Initialize permissions for new roles
    const updatedPerms = { ...rolePermissions };
    newRoles.forEach(role => {
      if (!updatedPerms[role.id]) {
        updatedPerms[role.id] = { ...defaultPermissions };
      }
    });
    setRolePermissions(updatedPerms);
  };

  const togglePermission = (roleId: string, permission: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permission]: !prev[roleId][permission]
      }
    }));
  };

  const selectAllForRole = (roleId: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
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
        canManageSettings: true
      }
    }));
  };

  const removeAllForRole = (roleId: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...defaultPermissions,
        canViewLogs: false,
        canViewMetrics: false
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Build payload
      const rolePermsArray = availableRoles.map(role => ({
        discordRoleId: role.id,
        discordRoleName: role.name,
        discordRoleColor: role.color,
        ...rolePermissions[role.id]
      }));

      await api.patch(`/api/org/${orgId}/discord/roles`, {
        rolePermissions: rolePermsArray
      });

      setSuccess('Role permissions updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (color: number | undefined) => {
    if (!color || color === 0) return '#99AAB5';
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="dark:text-white text-gray-900 font-bold">Loading Discord settings...</div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="dark:text-game-red-500 text-game-red-700 mb-4 font-bold">No organization found</p>
          <div className="pixel-corners-sm border-game-green-700 inline-block">
            <button
              onClick={() => navigate('/')}
              className="pixel-corners-sm-content px-4 py-2 bg-game-green-600 hover:bg-game-green-700 text-white shadow-game-sm font-bold"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentRole = availableRoles.find(r => r.id === selectedRole);
  const currentPermissions = selectedRole ? rolePermissions[selectedRole] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100">
      {/* Header */}
      <header className="dark:bg-gray-800/80 bg-white/90 backdrop-blur-md dark:border-gray-700 border-b-2 border-gray-300 sticky top-0 z-40 shadow-game-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <button
                  onClick={() => navigate('/settings')}
                  className="pixel-corners-sm-content px-3 sm:px-4 py-2 dark:text-gray-300 text-gray-700 dark:hover:text-white hover:text-black transition dark:hover:bg-gray-700 hover:bg-gray-100 text-sm sm:text-base whitespace-nowrap shadow-game-sm"
                >
                  ← Back
                </button>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-pixel dark:text-white text-gray-900">Role Permissions</h1>
            </div>
            <div className="pixel-corners-sm dark:bg-game-green-700 bg-game-green-600 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto">
              <button
                onClick={handleSave}
                disabled={saving || availableRoles.length === 0}
                className="pixel-corners-sm-content w-full sm:w-auto px-4 sm:px-6 py-2 dark:bg-game-green-600 bg-game-green-500 hover:bg-game-green-700 dark:hover:bg-game-green-500 disabled:bg-game-green-600/50 text-white text-sm sm:text-base transition disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {guildName && (
          <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 mb-6">
            <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm p-4 shadow-game">
              <p className="dark:text-gray-400 text-gray-600 text-sm">
                Configuring roles for: <span className="dark:text-white text-gray-900 font-bold">{guildName}</span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="pixel-corners-sm dark:border-game-red-900 border-game-red-400 mb-6">
            <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-4">
              <p className="dark:text-game-red-500 text-game-red-900 text-sm font-bold">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="pixel-corners-sm dark:border-green-800 border-green-300 mb-6">
            <div className="pixel-corners-sm-content dark:bg-green-900/20 bg-green-50 p-4">
              <p className="dark:text-green-400 text-green-800 text-sm font-bold">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Role List */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="dark:text-white text-gray-900 font-bold mb-3 text-sm sm:text-base">Discord Roles</h2>
            {availableRoles.length === 0 ? (
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm p-4">
                  <p className="dark:text-gray-400 text-gray-600 text-sm">No roles configured. Sync roles from Discord to get started.</p>
                </div>
              </div>
            ) : (
              availableRoles.map((role) => (
                <div key={role.id} className={`pixel-corners-sm ${
                  selectedRole === role.id
                    ? 'dark:border-game-primary-500 border-game-primary-600'
                    : 'dark:border-gray-700 border-gray-300'
                }`}>
                  <button
                    onClick={() => setSelectedRole(role.id)}
                    className={`pixel-corners-sm-content w-full p-3 text-left transition-all font-bold ${
                      selectedRole === role.id
                        ? 'dark:bg-gray-700/80 bg-gray-200 backdrop-blur-sm shadow-game'
                        : 'dark:bg-gray-800/50 bg-white backdrop-blur-sm dark:hover:border-gray-600 hover:border-gray-400 shadow-game-sm'
                    }`}
                  >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 border-2 dark:border-gray-600 border-gray-400"
                      style={{ backgroundColor: getRoleColor(role.color) }}
                    />
                    <span className="font-bold text-sm dark:text-white text-gray-900 truncate">{role.name}</span>
                  </div>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Permission Checkboxes */}
          <div className="lg:col-span-2">
            {currentRole && currentPermissions ? (
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm p-6 shadow-game">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6 pb-4 border-b-2 dark:border-gray-700 border-gray-300">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border-2 dark:border-gray-600 border-gray-400 flex-shrink-0"
                      style={{ backgroundColor: getRoleColor(currentRole.color) }}
                    />
                    <h2 className="text-base sm:text-lg font-bold dark:text-white text-gray-900 truncate">{currentRole.name}</h2>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="pixel-corners-xs dark:bg-game-green-700 bg-game-green-600 flex-1 sm:flex-none">
                      <button
                        onClick={() => selectAllForRole(selectedRole)}
                        className="pixel-corners-xs-content dark:bg-game-green-600 bg-game-green-500 px-3 py-1.5 dark:hover:bg-game-green-500 hover:bg-game-green-400 transition-colors w-full"
                      >
                        <span className="text-white font-bold text-xs whitespace-nowrap">Select All</span>
                      </button>
                    </div>
                    <div className="pixel-corners-xs dark:bg-gray-600 bg-gray-400 flex-1 sm:flex-none">
                      <button
                        onClick={() => removeAllForRole(selectedRole)}
                        className="pixel-corners-xs-content dark:bg-gray-700 bg-gray-300 px-3 py-1.5 dark:hover:bg-gray-600 hover:bg-gray-200 transition-colors w-full"
                      >
                        <span className="dark:text-white text-gray-900 font-bold text-xs whitespace-nowrap">Clear All</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      {/* Group Header */}
                      <div className="mb-3">
                        <div className={`pixel-corners-xs ${group.borderColor}`}>
                          <div className={`pixel-corners-xs-content ${group.bgColor} px-3 py-2`}>
                            <h5 className={`font-bold ${group.textColor}`}>{group.title}</h5>
                          </div>
                        </div>
                      </div>

                      {/* Permissions List */}
                      <div className="space-y-2.5">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-3 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={currentPermissions[perm.key as keyof typeof currentPermissions]}
                              onChange={() => togglePermission(selectedRole, perm.key)}
                              className="mt-0.5 w-5 h-5 rounded accent-game-green-600 dark:accent-game-green-500 focus:ring-2 focus:ring-game-green-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1">
                              <div className="font-bold text-sm dark:text-white text-gray-900 dark:group-hover:text-game-green-400 group-hover:text-game-green-600 transition-colors">
                                {perm.label}
                              </div>
                              <div className="text-xs dark:text-gray-400 text-gray-600 mt-0.5">
                                {perm.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            ) : (
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm p-6 text-center shadow-game">
                  <p className="dark:text-gray-400 text-gray-600">Select a role to configure permissions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
