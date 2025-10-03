import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, authApi } from '../lib/api';

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
    permissions: [
      { key: 'canCreateServer', label: 'Create Servers', description: 'Create new game servers' },
      { key: 'canDeleteServer', label: 'Delete Servers', description: 'Permanently delete servers' },
      { key: 'canStartServer', label: 'Start Servers', description: 'Start stopped servers' },
      { key: 'canStopServer', label: 'Stop Servers', description: 'Stop running servers' },
      { key: 'canRestartServer', label: 'Restart Servers', description: 'Restart servers' }
    ]
  },
  {
    title: 'Configuration',
    permissions: [
      { key: 'canEditConfig', label: 'Edit Config Files', description: 'Modify server.properties and configs' },
      { key: 'canEditFiles', label: 'Edit Server Files', description: 'Upload/edit/delete files' },
      { key: 'canInstallMods', label: 'Install Mods', description: 'Add plugins and mods' }
    ]
  },
  {
    title: 'Backups',
    permissions: [
      { key: 'canCreateBackup', label: 'Create Backups', description: 'Make server backups' },
      { key: 'canRestoreBackup', label: 'Restore Backups', description: 'Restore from backups' },
      { key: 'canDeleteBackup', label: 'Delete Backups', description: 'Remove backups' }
    ]
  },
  {
    title: 'Monitoring',
    permissions: [
      { key: 'canViewLogs', label: 'View Logs', description: 'Read server logs' },
      { key: 'canViewMetrics', label: 'View Metrics', description: 'See CPU, RAM, player count' },
      { key: 'canViewConsole', label: 'View Console', description: 'View live server console' },
      { key: 'canExecuteCommands', label: 'Execute Commands', description: 'Run console commands' }
    ]
  },
  {
    title: 'Administration',
    permissions: [
      { key: 'canManageMembers', label: 'Manage Members', description: 'Add/remove team members' },
      { key: 'canManageRoles', label: 'Manage Roles', description: 'Edit role permissions' },
      { key: 'canManageSettings', label: 'Manage Settings', description: 'Change organization settings' }
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
  const [syncing, setSyncing] = useState(false);
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

      // Merge existing permissions with newly synced roles
      setRolePermissions(prev => ({ ...permsMap, ...prev }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load Discord configuration');
    } finally {
      setLoading(false);
    }
  };

  const syncRolesFromDiscord = async () => {
    try {
      setSyncing(true);
      setError(null);

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

      setSuccess('Roles synced from Discord successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync roles from Discord');
    } finally {
      setSyncing(false);
    }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading Discord settings...</div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">No organization found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentRole = availableRoles.find(r => r.id === selectedRole);
  const currentPermissions = selectedRole ? rolePermissions[selectedRole] : null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/settings')}
                className="text-gray-400 hover:text-white transition"
              >
                ← Back to Settings
              </button>
              <h1 className="text-2xl font-bold text-white">Discord Role Permissions</h1>
            </div>
            <button
              onClick={syncRolesFromDiscord}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg text-sm font-medium transition"
            >
              {syncing ? 'Syncing...' : 'Sync Roles from Discord'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {guildName && (
          <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">
              Configuring roles for: <span className="text-white font-semibold">{guildName}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Role List */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-white font-semibold mb-3">Discord Roles</h2>
            {availableRoles.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">No roles configured. Sync roles from Discord to get started.</p>
              </div>
            ) : (
              availableRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedRole === role.id
                      ? 'bg-gray-700 border-2 border-blue-500'
                      : 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getRoleColor(role.color) }}
                    />
                    <span className="font-medium text-sm text-white truncate">{role.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Permission Checkboxes */}
          <div className="lg:col-span-2">
            {currentRole && currentPermissions ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getRoleColor(currentRole.color) }}
                    />
                    <h2 className="text-lg font-semibold text-white">{currentRole.name}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectAllForRole(selectedRole)}
                      className="px-3 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-500/20 transition"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => removeAllForRole(selectedRole)}
                      className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition"
                    >
                      Remove All
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">{group.title}</h3>
                      <div className="space-y-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={currentPermissions[perm.key as keyof typeof currentPermissions]}
                              onChange={() => togglePermission(selectedRole, perm.key)}
                              className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">{perm.label}</p>
                              <p className="text-xs text-gray-400">{perm.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">Select a role to configure permissions</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-700">
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || availableRoles.length === 0}
            className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
