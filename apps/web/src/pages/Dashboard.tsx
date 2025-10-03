import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Server as ServerIcon,
  Gamepad2,
  ChevronRight,
  Wifi,
  WifiOff,
  Terminal,
  HardDrive,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { serversApi, authApi } from '../lib/api';
import type { Server, ServerStatus } from '@spinup/shared';
import { GAMES, type GameImage } from '@spinup/shared';
import CreateServerWizard from '../components/CreateServerWizard';
import SystemHealthModal from '../components/SystemHealthModal';
import CommandPalette from '../components/CommandPalette';
import ServerBranding from '../components/ServerBranding';

// Status color mappings
const statusColors: Record<ServerStatus, string> = {
  RUNNING: 'text-green-500 bg-green-50 border-green-200',
  STOPPED: 'text-gray-500 bg-gray-50 border-gray-200',
  CREATING: 'text-blue-500 bg-blue-50 border-blue-200',
  ERROR: 'text-red-500 bg-red-50 border-red-200',
  DELETING: 'text-orange-500 bg-orange-50 border-orange-200',
};

// Status icon mappings
const statusIcons: Record<ServerStatus, React.ReactNode> = {
  RUNNING: <CheckCircle className="w-4 h-4" />,
  STOPPED: <XCircle className="w-4 h-4" />,
  CREATING: <Loader2 className="w-4 h-4 animate-spin" />,
  ERROR: <AlertCircle className="w-4 h-4" />,
  DELETING: <Loader2 className="w-4 h-4 animate-spin" />,
};

// Game icon mappings
const gameIcons: Record<string, string> = {
  'minecraft-java': '⛏️',
  'minecraft-bedrock': '⛏️',
  'valheim': '⚔️',
  'factorio': '🏭',
  'zomboid': '🧟',
  'ark': '🦕',
  'palworld': '🐾',
  'rust': '🔧',
  'terraria': '🌳',
  'cs2': '🔫',
  'satisfactory': '⚙️',
  '7dtd': '💀',
  'tf2': '🎯',
  'squad': '🪖',
  'mordhau': '🗡️',
  'dst': '🌙',
  'starbound': '🚀',
  'vrising': '🧛',
  'custom': '🔧',
};

// Get server IP from environment
const getServerIP = () => {
  const webOrigin = import.meta.env.VITE_WEB_ORIGIN || window.location.origin;
  try {
    const url = new URL(webOrigin);
    return url.hostname;
  } catch {
    return 'localhost';
  }
};

type FilterStatus = 'all' | ServerStatus;

export default function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current user and organization
  const { data: authData, isLoading: authLoading, error: authError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
  });

  // Fetch servers list
  const {
    data: servers = [],
    isLoading: serversLoading,
    error: serversError,
  } = useQuery({
    queryKey: ['servers', authData?.org?.id],
    queryFn: () => serversApi.list(authData!.org.id),
    enabled: !!authData?.org?.id,
  });

  // Start server mutation
  const startServerMutation = useMutation({
    mutationFn: serversApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  // Stop server mutation
  const stopServerMutation = useMutation({
    mutationFn: serversApi.stop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      navigate('/');
      window.location.reload();
    },
  });

  // Filter and search servers
  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const matchesFilter = filterStatus === 'all' || server.status === filterStatus;
      const game = GAMES.find((g: GameImage) => g.key === server.gameKey);
      const gameName = game?.name || '';
      const matchesSearch =
        server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gameName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [servers, filterStatus, searchTerm]);

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: servers.length,
      running: servers.filter((s) => s.status === 'RUNNING').length,
      stopped: servers.filter((s) => s.status === 'STOPPED').length,
      issues: servers.filter((s) => s.status === 'ERROR').length,
    }),
    [servers]
  );

  const handleServerClick = (serverId: string) => {
    navigate(`/servers/${serverId}`);
  };

  const handleStartServer = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    startServerMutation.mutate(serverId);
  };

  const handleStopServer = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    stopServerMutation.mutate(serverId);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Keyboard shortcut for command palette (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle auth error - redirect to login
  if (authError || !authData) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                SpinUp
              </h1>
              {authData?.org && (
                <>
                  <span className="text-gray-300">/</span>
                  <ServerBranding org={authData.org} />
                </>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Command Palette (⌘K)"
              >
                <Terminal className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowHealthModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
              >
                <Activity className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                <span>Create Server</span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {authData?.user?.avatarUrl ? (
                    <img
                      src={authData.user.avatarUrl}
                      alt={authData.user.displayName || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-3 mb-2">
                          {authData?.user?.avatarUrl ? (
                            <img
                              src={authData.user.avatarUrl}
                              alt={authData.user.displayName || 'User'}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {authData?.user?.displayName || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {authData?.org?.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Servers</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <ServerIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Running</p>
                <p className="text-3xl font-bold text-green-600">{stats.running}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Stopped</p>
                <p className="text-3xl font-bold text-gray-600">{stats.stopped}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <WifiOff className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Issues</p>
                <p className="text-3xl font-bold text-red-600">{stats.issues}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-4 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search servers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'RUNNING', 'STOPPED', 'ERROR'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-xl transition-all ${
                    filterStatus === status
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {serversError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Error loading servers</h3>
                <p className="text-sm text-red-700">
                  {serversError instanceof Error ? serversError.message : 'An error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {serversLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!serversLoading && filteredServers.length === 0 && !serversError && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <ServerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No servers found' : 'No servers yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first game server'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Server</span>
              </button>
            )}
          </div>
        )}

        {/* Server Grid */}
        {!serversLoading && filteredServers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onClick={() => handleServerClick(server.id)}
                onStart={(e) => handleStartServer(e, server.id)}
                onStop={(e) => handleStopServer(e, server.id)}
                isStarting={startServerMutation.isPending}
                isStopping={stopServerMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Server Modal */}
      {showCreateModal && authData?.org && (
        <CreateServerWizard
          orgId={authData.org.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['servers'] });
          }}
        />
      )}

      {/* System Health Modal */}
      {showHealthModal && (
        <SystemHealthModal onClose={() => setShowHealthModal(false)} />
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          servers={servers}
          onCreateServer={() => setShowCreateModal(true)}
          onStartServer={(id) => startServerMutation.mutate(id)}
          onStopServer={(id) => stopServerMutation.mutate(id)}
          onDeleteServer={(id) => {
            serversApi.delete(id).then(() => {
              queryClient.invalidateQueries({ queryKey: ['servers'] });
            });
          }}
          onShowHealth={() => setShowHealthModal(true)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// Server Card Component
interface ServerCardProps {
  server: Server;
  onClick: () => void;
  onStart: (e: React.MouseEvent) => void;
  onStop: (e: React.MouseEvent) => void;
  isStarting: boolean;
  isStopping: boolean;
}

function ServerCard({ server, onClick, onStart, onStop, isStarting, isStopping }: ServerCardProps) {
  const game = GAMES.find((g: GameImage) => g.key === server.gameKey);
  const gameName = game?.name || server.gameKey;
  const primaryPort = server.ports[0]?.host || '-';
  const serverIP = getServerIP();

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-200 hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] group"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">{gameIcons[server.gameKey] || '🎮'}</div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{server.name}</h3>
              <p className="text-sm text-gray-500">{gameName}</p>
            </div>
          </div>
          <div
            className={`flex items-center space-x-1 px-3 py-1 rounded-full border ${
              statusColors[server.status]
            }`}
          >
            {statusIcons[server.status]}
            <span className="text-xs font-medium">{server.status}</span>
          </div>
        </div>

        {server.status === 'RUNNING' && (
          <div className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">IP Address</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-gray-900">{serverIP}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(serverIP);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy IP"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Port</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-gray-900">{primaryPort}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(primaryPort.toString());
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy Port"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              {game?.steamGame ? (
                <>
                  <a
                    href={`steam://connect/${serverIP}:${primaryPort}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm text-center flex items-center justify-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Steam</span>
                  </a>
                  <button
                    onClick={onStop}
                    disabled={isStopping}
                    className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-1"
                  >
                    {isStopping ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Stopping</span>
                      </>
                    ) : (
                      <span>Stop</span>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={onStop}
                  disabled={isStopping}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-1"
                >
                  {isStopping ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Stopping</span>
                    </>
                  ) : (
                    <span>Stop Server</span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {server.status === 'STOPPED' && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <WifiOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Server is offline</p>
            </div>
            <button
              onClick={onStart}
              disabled={isStarting}
              className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-1"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Starting</span>
                </>
              ) : (
                <span>Start Server</span>
              )}
            </button>
          </div>
        )}

        {server.status === 'CREATING' && (
          <div className="text-center py-4">
            <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-blue-600">Setting up server...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        )}

        {server.status === 'ERROR' && (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">Server encountered an error</p>
            <button className="mt-2 text-xs text-red-600 underline">View logs</button>
          </div>
        )}

        {server.status === 'DELETING' && (
          <div className="text-center py-4">
            <Loader2 className="w-8 h-8 text-orange-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-orange-600">Deleting server...</p>
          </div>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3 h-3" />
              <span>{server.gameKey}</span>
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
        </div>
      </div>
    </div>
  );
}
