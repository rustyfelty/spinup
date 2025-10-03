import { useState, useEffect } from 'react';
import axios from 'axios';
import { StepProps } from '../Setup';

const API_URL = import.meta.env.VITE_API_URL || '';

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
  canViewLogs: true,  // Default to true
  canViewMetrics: true,  // Default to true
  canViewConsole: false,
  canExecuteCommands: false,
  canManageMembers: false,
  canManageRoles: false,
  canManageSettings: false
};

const allPermissionsEnabled = {
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
};

interface RolesStepProps extends StepProps {
  sessionToken: string;
  selectedGuildId: string;
}

export default function RolesStep({ onNext, onBack, setupStatus, refreshStatus, sessionToken, selectedGuildId }: RolesStepProps) {
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    if (selectedGuildId && sessionToken) {
      fetchGuildRoles(selectedGuildId);
    }
  }, [selectedGuildId, sessionToken]);

  const fetchGuildRoles = async (guildId: string) => {
    setFetchingRoles(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/setup/guild/${guildId}/roles`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`
        }
      });
      const fetchedRoles = response.data.roles || [];
      const guildName = response.data.guildName || '';

      setRoles(fetchedRoles);

      // Auto-fill organization name with guild name if not already set
      if (!orgName && guildName) {
        setOrgName(guildName);
      }

      // Initialize permissions for all roles
      // Admin roles get all permissions enabled by default
      const initialPermissions: RolePermissions = {};
      fetchedRoles.forEach((role: DiscordRole) => {
        // Check if role name suggests admin/owner privileges
        const isAdminRole = /admin|owner|moderator|mod/i.test(role.name);
        initialPermissions[role.id] = isAdminRole ? { ...allPermissionsEnabled } : { ...defaultPermissions };
      });
      setRolePermissions(initialPermissions);

      // Select first role by default
      if (fetchedRoles.length > 0) {
        setSelectedRole(fetchedRoles[0].id);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Discord roles';

      // Special handling for rate limit errors
      if (errorMessage.includes('rate limit')) {
        setError('Discord API rate limit reached. Please wait 1-2 minutes and refresh the page to try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setFetchingRoles(false);
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
      [roleId]: { ...allPermissionsEnabled }
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

  const selectAllInGroup = (roleId: string, group: typeof permissionGroups[0]) => {
    setRolePermissions(prev => {
      const updated = { ...prev[roleId] };
      group.permissions.forEach(perm => {
        updated[perm.key as keyof typeof updated] = true;
      });
      return {
        ...prev,
        [roleId]: updated
      };
    });
  };

  const removeAllInGroup = (roleId: string, group: typeof permissionGroups[0]) => {
    setRolePermissions(prev => {
      const updated = { ...prev[roleId] };
      group.permissions.forEach(perm => {
        updated[perm.key as keyof typeof updated] = false;
      });
      return {
        ...prev,
        [roleId]: updated
      };
    });
  };

  const getRoleColor = (color: number | undefined) => {
    if (!color || color === 0) return '#99AAB5'; // Default Discord gray
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  const handleComplete = async () => {
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    if (!selectedGuildId) {
      setError('No guild selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build role permissions array
      const rolePermsArray = roles.map(role => ({
        discordRoleId: role.id,
        discordRoleName: role.name,
        discordRoleColor: role.color,
        permissions: rolePermissions[role.id] || defaultPermissions
      }));

      // First, configure roles (sets rolesConfigured flag)
      await axios.post(`${API_URL}/api/setup/configure-roles`, {
        guildId: selectedGuildId,
        rolePermissions: rolePermsArray
      });

      // Then complete setup
      await axios.post(`${API_URL}/api/setup/complete`, {
        orgName,
        rolePermissions: rolePermsArray
      });

      await refreshStatus();
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingRoles) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Discord roles...</p>
      </div>
    );
  }

  const currentRole = roles.find(r => r.id === selectedRole);
  const currentPermissions = selectedRole ? rolePermissions[selectedRole] : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Configure Permissions
        </h3>
        <p className="text-gray-600 mb-4">
          Set what each Discord role can do in SpinUp. Select a role and check the actions they're allowed to perform.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> We're showing your Discord roles from the selected server.
            Configure permissions for your admin roles now, and you can add more roles later as team members join.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Organization Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="My Gaming Community"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {roles.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No roles found for your account in this server. You may need to be assigned a role in Discord first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Role List */}
          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Discord Roles</h4>
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  selectedRole === role.id
                    ? 'bg-indigo-50 border-2 border-indigo-600'
                    : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getRoleColor(role.color) }}
                  />
                  <span className="font-medium text-sm truncate">{role.name}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Permission Checkboxes */}
          <div className="lg:col-span-2">
            {currentRole && currentPermissions ? (
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getRoleColor(currentRole.color) }}
                    />
                    <h4 className="text-lg font-semibold text-gray-800">{currentRole.name}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectAllForRole(selectedRole)}
                      className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => removeAllForRole(selectedRole)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                    >
                      Remove All
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-gray-700">{group.title}</h5>
                        <div className="flex gap-2">
                          <button
                            onClick={() => selectAllInGroup(selectedRole, group)}
                            className="px-2 py-0.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => removeAllInGroup(selectedRole, group)}
                            className="px-2 py-0.5 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                          >
                            Remove All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-3 p-2 rounded hover:bg-white cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={currentPermissions[perm.key as keyof typeof currentPermissions]}
                              onChange={() => togglePermission(selectedRole, perm.key)}
                              className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{perm.label}</p>
                              <p className="text-xs text-gray-500">{perm.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
                Select a role to configure permissions
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Users can have multiple Discord roles. They'll get all permissions from all their roles combined.
        </p>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={loading || !orgName.trim()}
          className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Completing Setup...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}
