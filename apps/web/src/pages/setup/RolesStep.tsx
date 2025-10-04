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
    borderColor: 'dark:bg-purple-700 bg-purple-400',
    bgColor: 'dark:bg-purple-600 bg-purple-500',
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
    borderColor: 'dark:bg-purple-800 bg-purple-400',
    bgColor: 'dark:bg-purple-700 bg-purple-500',
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
  const [loading, setLoading] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

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

      // Sort roles by position (highest position first)
      fetchedRoles.sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);

      setRoles(fetchedRoles);

      if (!orgName && guildName) {
        setOrgName(guildName);
      }

      const initialPermissions: RolePermissions = {};
      fetchedRoles.forEach((role: DiscordRole) => {
        const isAdminRole = /admin|owner|moderator|mod/i.test(role.name);
        initialPermissions[role.id] = isAdminRole ? { ...allPermissionsEnabled } : { ...defaultPermissions };
      });
      setRolePermissions(initialPermissions);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Discord roles';
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

  const toggleAllForRole = (roleId: string) => {
    const currentPerms = rolePermissions[roleId];
    const hasAnyEnabled = Object.values(currentPerms).some(v => v);

    setRolePermissions(prev => ({
      ...prev,
      [roleId]: hasAnyEnabled
        ? { ...defaultPermissions, canViewLogs: false, canViewMetrics: false }
        : { ...allPermissionsEnabled }
    }));
  };

  const togglePermissionForAll = (permission: string) => {
    const allHavePermission = roles.every(role => rolePermissions[role.id][permission as keyof typeof defaultPermissions]);

    setRolePermissions(prev => {
      const updated = { ...prev };
      roles.forEach(role => {
        updated[role.id] = {
          ...updated[role.id],
          [permission]: !allHavePermission
        };
      });
      return updated;
    });
  };

  const toggleRoleExpanded = (roleId: string) => {
    setExpandedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  const getRoleColor = (color: number | undefined) => {
    if (!color || color === 0) return '#99AAB5';
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
      const rolePermsArray = roles.map(role => ({
        discordRoleId: role.id,
        discordRoleName: role.name,
        discordRoleColor: role.color,
        permissions: rolePermissions[role.id] || defaultPermissions
      }));

      await axios.post(`${API_URL}/api/setup/configure-roles`, {
        guildId: selectedGuildId,
        rolePermissions: rolePermsArray
      });

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
        <div className="w-16 h-16 border-4 dark:border-game-green-400 border-game-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="dark:text-gray-400 text-gray-600 font-bold">Loading Discord roles...</p>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="pixel-corners-sm dark:bg-yellow-800 bg-yellow-200">
          <div className="pixel-corners-sm-content dark:bg-yellow-900/20 bg-yellow-50 p-6 text-center">
            <p className="text-2xl mb-4">⚠️</p>
            <p className="dark:text-yellow-300 text-yellow-800 font-bold mb-2">No roles found</p>
            <p className="dark:text-yellow-400 text-yellow-700 text-sm">
              No roles found for your account in this server. You may need to be assigned a role in Discord first.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border-2 dark:border-gray-700 border-gray-300 rounded-chunky-sm dark:hover:bg-gray-700 hover:bg-gray-100 transition-colors dark:text-white text-gray-900 font-bold"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="pixel-corners-sm dark:bg-purple-800 bg-purple-200">
        <div className="pixel-corners-sm-content dark:bg-purple-900/20 bg-purple-50 p-4">
          <p className="dark:text-purple-300 text-purple-800">
            <strong>How it works:</strong> Check the boxes to give each Discord role permission to perform actions in SpinUp.
            Users with multiple roles get all permissions from their roles combined.
          </p>
        </div>
      </div>

      {/* Organization Name */}
      <div className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game">
        <div className="pixel-corners-content dark:bg-gray-800 bg-white p-6">
          <label className="block mb-2">
            <span className="text-sm font-bold dark:text-gray-300 text-gray-700">
              Organization Name <span className="text-game-red-600">*</span>
            </span>
            <p className="text-xs dark:text-gray-400 text-gray-600 mb-3">
              This will be the name of your organization in SpinUp
            </p>
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="My Gaming Community"
            className="w-full px-4 py-3 border-2 dark:border-gray-700 border-gray-300 rounded-chunky-sm focus:ring-2 focus:ring-game-green-500 focus:border-game-green-500 dark:bg-gray-700 dark:text-white text-gray-900 font-bold placeholder:font-normal dark:placeholder:text-gray-500 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Role Cards */}
      <div className="space-y-4">
        {roles.map((role) => {
          const isExpanded = expandedRoles.has(role.id);

          return (
            <div key={role.id} className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game">
              <div className="pixel-corners-content dark:bg-gray-800 bg-white">
                {/* Role Header - Clickable */}
                <button
                  onClick={() => toggleRoleExpanded(role.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 border-2 dark:border-gray-600 border-gray-400"
                      style={{ backgroundColor: getRoleColor(role.color) }}
                    />
                    <h4 className="font-bold dark:text-white text-gray-900">{role.name}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs dark:text-gray-400 text-gray-600">
                      {isExpanded ? 'Click to collapse' : 'Click to expand'}
                    </span>
                    <span className={`dark:text-gray-400 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t-2 dark:border-gray-700 border-gray-300">
                    {/* Quick Actions */}
                    <div className="flex gap-2 mb-6">
                      <button
                        onClick={() => setRolePermissions(prev => ({
                          ...prev,
                          [role.id]: { ...allPermissionsEnabled }
                        }))}
                        className="pixel-corners-xs dark:bg-game-green-700 bg-game-green-600"
                      >
                        <div className="pixel-corners-xs-content dark:bg-game-green-600 bg-game-green-500 px-3 py-1.5 dark:hover:bg-game-green-500 hover:bg-game-green-400 transition-colors">
                          <span className="text-white font-bold text-xs">Select All</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setRolePermissions(prev => ({
                          ...prev,
                          [role.id]: { ...defaultPermissions, canViewLogs: false, canViewMetrics: false }
                        }))}
                        className="pixel-corners-xs dark:bg-gray-600 bg-gray-400"
                      >
                        <div className="pixel-corners-xs-content dark:bg-gray-700 bg-gray-300 px-3 py-1.5 dark:hover:bg-gray-600 hover:bg-gray-200 transition-colors">
                          <span className="dark:text-white text-gray-900 font-bold text-xs">Clear All</span>
                        </div>
                      </button>
                    </div>

                    {/* Permission Groups */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {permissionGroups.map(group => (
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
                            {group.permissions.map(perm => (
                              <label
                                key={perm.key}
                                className="flex items-start gap-3 cursor-pointer group"
                              >
                                <input
                                  type="checkbox"
                                  checked={rolePermissions[role.id]?.[perm.key as keyof typeof defaultPermissions] || false}
                                  onChange={() => togglePermission(role.id, perm.key)}
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="pixel-corners-sm dark:bg-game-red-900 bg-game-red-400">
          <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-4">
            <p className="dark:text-game-red-500 text-game-red-900 text-sm font-bold">{error}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t-2 dark:border-gray-700 border-gray-300">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 border-2 dark:border-gray-700 border-gray-300 rounded-chunky-sm dark:hover:bg-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 dark:text-white text-gray-900 font-bold"
        >
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={loading || !orgName.trim()}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-game-green-600 to-game-green-700 text-white rounded-chunky-sm border-[3px] border-game-green-800 shadow-game-light hover:shadow-game disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 font-bold"
        >
          {loading ? 'Completing Setup...' : 'Complete Setup →'}
        </button>
      </div>
    </div>
  );
}
