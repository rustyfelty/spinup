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
  MemoryStick,
  Cpu,
  Zap,
} from 'lucide-react';
import { serversApi, authApi } from '../lib/api';
import type { Server, ServerStatus } from '@spinup/shared';
import { GAMES, type GameImage } from '@spinup/shared';
import CreateServerWizard from '../components/CreateServerWizard';
import SystemHealthModal from '../components/SystemHealthModal';
import CommandPalette from '../components/CommandPalette';
import SystemHealthBar from '../components/SystemHealthBar';
import ThemeToggle from '../components/ThemeToggle';

// Status color mappings
const statusColors: Record<ServerStatus, string> = {
  RUNNING: 'text-green-500 bg-green-50 border-green-200',
  STOPPED: 'text-gray-500 bg-gray-50 border-gray-200',
  CREATING: 'text-game-purple-500 bg-game-purple-50 border-game-purple-200',
  ERROR: 'text-game-red-600 bg-game-red-100 border-game-red-300',
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

// Helper to construct Discord CDN URLs
const getDiscordIconUrl = (guildId: string, iconHash: string, size: number = 128) => {
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${iconHash.startsWith('a_') ? 'gif' : 'png'}?size=${size}`
}

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
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-game-green-500 mx-auto mb-4" />
          <p className="dark:text-gray-300 text-gray-600">Loading...</p>
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
    <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100">
      {/* Header */}
      <header className="dark:bg-gray-800/95 bg-white dark:border-gray-700 border-b border-gray-200 sticky top-0 z-40 backdrop-blur-sm shadow-game-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="pixel-corners-sm dark:bg-game-purple-800 bg-game-purple-500 shadow-game-sm">
                <div className="pixel-corners-sm-content bg-gradient-to-br from-game-purple-600 to-game-purple-700 p-2">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
              </div>
              <h1 className="text-xl font-pixel bg-gradient-to-r from-game-purple-600 to-game-purple-700 bg-clip-text text-transparent dark:from-game-purple-400 dark:to-game-purple-500">
                SpinUp
              </h1>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
              <SystemHealthBar onClick={() => setShowHealthModal(true)} />
              <button
                onClick={() => setShowCommandPalette(true)}
                className="hidden md:flex pixel-corners-sm dark:bg-gray-700 bg-gray-300 transition-all duration-150 hover:shadow-game-sm active:translate-y-1 active:shadow-none"
                title="Command Palette (⌘K)"
              >
                <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white dark:hover:bg-gray-700 hover:bg-gray-50 p-2 transition-colors">
                  <Terminal className="w-5 h-5 dark:text-gray-300 text-gray-600" />
                </div>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="pixel-corners-sm dark:bg-game-purple-600 bg-game-purple-500 shadow-game-sm hover:shadow-game transition-all duration-200 hover:scale-[1.02] active:translate-y-1 active:shadow-none overflow-hidden"
              >
                <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white flex items-center space-x-2 px-3 md:px-4 py-2 border-l-4 dark:border-game-purple-500 border-game-purple-600 transition-all duration-300 dark:hover:bg-game-purple-600 hover:bg-game-purple-500 relative group">
                  <div className="absolute inset-0 dark:bg-game-purple-600 bg-game-purple-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
                  <Plus className="w-4 h-4 dark:text-game-purple-400 text-game-purple-600 transition-colors group-hover:text-white relative z-10" />
                  <span className="dark:text-game-purple-400 text-game-purple-700 font-bold text-sm md:text-base transition-colors group-hover:text-white relative z-10">
                    <span className="hidden sm:inline">Create Server</span>
                    <span className="sm:hidden">Create</span>
                  </span>
                </div>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 transition-all duration-150 hover:shadow-game-sm active:translate-y-1 active:shadow-none"
                ><div className="pixel-corners-sm-content dark:bg-gray-800 bg-white dark:hover:bg-gray-700 hover:bg-gray-50 flex items-center space-x-2 p-2 transition-colors">
                  {authData?.user?.avatarUrl ? (
                    <img
                      src={authData.user.avatarUrl}
                      alt={authData.user.displayName || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-game-green-500 to-game-green-700 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 dark:text-gray-300 text-gray-600" />
                </div>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 z-50">
                      <div className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game">
                        <div className="pixel-corners-content dark:bg-gray-800 bg-white overflow-hidden">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b-2 dark:border-gray-700 border-gray-300 dark:bg-gray-900/50 bg-gray-50">
                        <div className="flex items-center space-x-3 mb-2">
                          {authData?.user?.avatarUrl ? (
                            <img
                              src={authData.user.avatarUrl}
                              alt={authData.user.displayName || 'User'}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-game-green-500 to-game-green-700 rounded-full flex items-center justify-center border-2 border-game-green-600">
                              <User className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold dark:text-white text-gray-900 truncate">
                              {authData?.user?.displayName || 'User'}
                            </p>
                            <p className="text-xs dark:text-gray-400 text-gray-500 truncate">
                              {authData?.org?.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <div className="px-4 py-2 flex items-center justify-between border-b dark:border-gray-700 border-gray-300">
                          <span className="text-sm dark:text-gray-300 text-gray-700 font-bold">Theme</span>
                          <ThemeToggle />
                        </div>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm dark:text-gray-300 text-gray-700 dark:hover:bg-gray-700 hover:bg-gray-50 transition-colors font-bold"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm dark:text-game-red-500 text-game-red-700 dark:hover:bg-game-red-900/20 hover:bg-game-red-100 transition-colors font-bold"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Organization Info Sub-Header */}
      {authData?.org && (() => {
        const guildId = authData.org.discordGuildId || authData.org.discordGuild
        const iconUrl = authData.org.discordIconHash && guildId
          ? getDiscordIconUrl(guildId, authData.org.discordIconHash, 80)
          : null

        return (
          <div className="dark:bg-gray-800 bg-white dark:border-b border-b dark:border-gray-700 border-gray-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* Left: Discord Server Info */}
                <div className="flex items-center gap-3">
                  {/* Discord Server Icon */}
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={authData.org.discordGuildName || authData.org.name}
                      className="w-10 h-10 rounded-full border-2 dark:border-game-green-500 border-game-green-600 shadow-game-sm"
                    />
                  ) : authData.org.discordGuildId ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-game-green-500 to-game-green-700 flex items-center justify-center border-2 dark:border-game-green-500 border-game-green-600 shadow-game-sm">
                      <span className="text-white font-bold text-sm">
                        {(authData.org.discordGuildName || authData.org.name).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-game-green-500 to-game-green-700 flex items-center justify-center border-2 border-game-green-600 shadow-game-sm">
                      <ServerIcon className="w-5 h-5 text-white" />
                    </div>
                  )}

                  {/* Server Name */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold dark:text-white text-gray-900">
                      {authData.org.discordGuildName || authData.org.name}
                    </h2>
                    {authData.org.discordGuildId && (
                      <span className="text-xs px-2 py-0.5 rounded dark:bg-game-purple-900/30 bg-game-purple-100 dark:text-game-purple-400 text-game-purple-700 font-medium">
                        Discord
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Quick Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ServerIcon className="w-4 h-4 dark:text-gray-400 text-gray-500" />
                    <span className="font-bold dark:text-white text-gray-900">{stats.total}</span>
                    <span className="dark:text-gray-400 text-gray-500 hidden sm:inline">total</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-game-green-500" />
                    <span className="font-bold text-game-green-500">{stats.running}</span>
                    <span className="dark:text-gray-400 text-gray-500 hidden sm:inline">online</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 dark:text-gray-400 text-gray-500" />
                    <span className="font-bold dark:text-gray-400 text-gray-600">{stats.stopped}</span>
                    <span className="dark:text-gray-400 text-gray-500 hidden sm:inline">offline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-game-red-600" />
                    <span className="font-bold text-game-red-600">{stats.issues}</span>
                    <span className="dark:text-gray-400 text-gray-500 hidden sm:inline">issues</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="pixel-corners dark:bg-gray-700 bg-gray-300 mb-6 shadow-game-light">
          <div className="pixel-corners-content dark:bg-gray-800 bg-white p-4">
            <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 pixel-corners-sm dark:bg-gray-700 bg-gray-300">
              <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white">
                <input
                  type="text"
                  placeholder="Search servers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-game-green-500 dark:bg-gray-700 bg-white dark:text-white text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['all', 'RUNNING', 'STOPPED', 'ERROR'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`pixel-corners-sm transition-all ${
                    filterStatus === status
                      ? 'dark:bg-game-purple-600 bg-game-purple-700 shadow-game-sm'
                      : 'dark:bg-gray-600 bg-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                  }`}
                >
                  <div className={`pixel-corners-sm-content px-4 py-2 font-bold ${
                    filterStatus === status
                      ? 'bg-game-purple-600 dark:bg-game-purple-500 text-white'
                      : 'dark:bg-gray-700 bg-gray-100 dark:text-gray-300 text-gray-600'
                  }`}>
                    {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </div>
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Error State */}
        {serversError && (
          <div className="pixel-corners dark:bg-game-red-900 bg-game-red-400 mb-6 shadow-game-sm">
            <div className="pixel-corners-content dark:bg-game-red-900/20 bg-game-red-100 p-6">
              <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-game-red-600" />
              <div>
                <h3 className="font-semibold dark:text-game-red-500 text-game-red-900">Error loading servers</h3>
                <p className="text-sm dark:text-game-red-400 text-game-red-800">
                  {serversError instanceof Error ? serversError.message : 'An error occurred'}
                </p>
              </div>
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
                className="pixel-corners dark:bg-gray-700 bg-gray-300 animate-pulse shadow-game-sm"
              >
                <div className="pixel-corners-content dark:bg-gray-800 bg-white p-6">
                <div className="h-6 dark:bg-gray-700 bg-gray-200 w-3/4 mb-4"></div>
                <div className="h-4 dark:bg-gray-700 bg-gray-200 w-1/2 mb-2"></div>
                <div className="h-4 dark:bg-gray-700 bg-gray-200 w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!serversLoading && filteredServers.length === 0 && !serversError && (
          <div className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game-light">
            <div className="pixel-corners-content dark:bg-gray-800 bg-white p-12 text-center">
            <ServerIcon className="w-16 h-16 dark:text-gray-600 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold dark:text-white text-gray-900 mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No servers found' : 'No servers yet'}
            </h3>
            <p className="dark:text-gray-400 text-gray-600 mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first game server'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="pixel-corners-sm dark:bg-game-purple-800 bg-game-purple-700 shadow-game-sm hover:shadow-game transition-all duration-200 hover:scale-105"
              >
                <div className="pixel-corners-sm-content bg-gradient-to-r from-game-purple-600 to-game-purple-700 dark:from-game-purple-500 dark:to-game-purple-600 inline-flex items-center space-x-2 px-6 py-3 text-white font-bold">
                  <Plus className="w-5 h-5" />
                  <span>Create Your First Server</span>
                </div>
              </button>
            )}
            </div>
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

  // Border color based on server status
  const getBorderColor = () => {
    switch (server.status) {
      case 'RUNNING':
        return 'dark:bg-game-purple-600 bg-game-purple-500';
      case 'STOPPED':
        return 'dark:bg-gray-600 bg-gray-400';
      case 'ERROR':
        return 'dark:bg-gray-600 bg-gray-400';
      case 'CREATING':
        return 'dark:bg-game-purple-600 bg-game-purple-500';
      case 'DELETING':
        return 'dark:bg-gray-600 bg-gray-400';
      default:
        return 'dark:bg-gray-600 bg-gray-400';
    }
  };

  // Status badge configuration
  const getStatusConfig = () => {
    switch (server.status) {
      case 'RUNNING':
        return {
          icon: <Wifi className="w-3.5 h-3.5" />,
          text: 'ONLINE',
          colors: 'dark:bg-game-purple-700 bg-game-purple-600',
          contentColors: 'dark:bg-game-purple-600 bg-game-purple-500 text-white',
        };
      case 'STOPPED':
        return {
          icon: <WifiOff className="w-3.5 h-3.5" />,
          text: 'OFFLINE',
          colors: 'dark:bg-gray-600 bg-gray-400',
          contentColors: 'dark:bg-gray-800 bg-gray-100 dark:text-gray-300 text-gray-600',
        };
      case 'CREATING':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          text: 'CREATING',
          colors: 'dark:bg-game-purple-600 bg-game-purple-500',
          contentColors: 'dark:bg-game-purple-900/30 bg-game-purple-100 dark:text-game-purple-300 text-game-purple-700',
        };
      case 'ERROR':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          text: 'ERROR',
          colors: 'dark:bg-game-red-700 bg-game-red-500',
          contentColors: 'dark:bg-game-red-900/30 bg-game-red-100 dark:text-game-red-300 text-game-red-700',
        };
      case 'DELETING':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          text: 'DELETING',
          colors: 'dark:bg-orange-600 bg-orange-500',
          contentColors: 'dark:bg-orange-900/30 bg-orange-100 dark:text-orange-300 text-orange-700',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      onClick={onClick}
      className={`pixel-corners ${getBorderColor()} hover:shadow-game transition-all duration-200 cursor-pointer hover:scale-[1.02] group shadow-game-light`}
    >
      <div className="pixel-corners-content dark:bg-gray-800 bg-white overflow-hidden">
        {/* Header Section */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-4">
            {/* Left: Icon and Name */}
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              {/* Game Icon */}
              <div className={`pixel-corners-sm shadow-game-sm flex-shrink-0 ${
                server.status === 'RUNNING' || server.status === 'CREATING'
                  ? 'dark:bg-game-purple-600 bg-game-purple-500'
                  : 'dark:bg-gray-600 bg-gray-300'
              }`}>
                <div className={`pixel-corners-sm-content p-2 ${
                  server.status === 'RUNNING' || server.status === 'CREATING'
                    ? 'dark:bg-game-purple-700 bg-game-purple-400'
                    : 'dark:bg-gray-700 bg-gray-100'
                }`}>
                  <div className="text-2xl leading-none">{gameIcons[server.gameKey] || '🎮'}</div>
                </div>
              </div>

              {/* Server Name and Game Type */}
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-bold dark:text-white text-gray-900 text-base leading-tight truncate mb-1">
                  {server.name}
                </h3>
                <p className="text-xs dark:text-gray-400 text-gray-500 truncate">{gameName}</p>
              </div>
            </div>

            {/* Right: Status Badge */}
            <div className="flex-shrink-0 ml-3">
              <div className={`pixel-corners-xs ${statusConfig.colors} shadow-game-sm`}>
                <div className={`pixel-corners-xs-content flex items-center space-x-1.5 px-3 py-1.5 ${statusConfig.contentColors}`}>
                  {statusConfig.icon}
                  <span className="text-xs font-bold tracking-wider">{statusConfig.text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Creator Info */}
          <div className="flex items-center space-x-2 mb-3 text-xs">
            <span className="dark:text-gray-400 text-gray-500">Created by</span>
            <div className="flex items-center space-x-1.5">
              {(server as any).creator?.avatarUrl ? (
                <img
                  src={(server as any).creator.avatarUrl}
                  alt={(server as any).creator.displayName}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <div className="w-4 h-4 rounded-full dark:bg-gray-600 bg-gray-300 flex items-center justify-center">
                  <User className="w-2.5 h-2.5 dark:text-gray-400 text-gray-600" />
                </div>
              )}
              <span className="dark:text-white text-gray-900 font-semibold">
                {(server as any).creator?.displayName || 'System'}
              </span>
            </div>
          </div>

          {/* Resource Indicators */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {/* Memory Usage */}
            <div className="pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-400">
              <div className="pixel-corners-xs-content dark:bg-gray-800 bg-white p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1">
                    <MemoryStick className="w-3 h-3 dark:text-game-purple-400 text-game-purple-600" />
                    <span className="dark:text-gray-400 text-gray-600 font-medium">RAM</span>
                  </div>
                  <span className="dark:text-white text-gray-900 font-bold">
                    {server.memoryCap ? `${(server.memoryCap / 1024).toFixed(1)}G` : '2G'}
                  </span>
                </div>
                <div className="w-full dark:bg-gray-700 bg-gray-200 h-1.5 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-game-purple-500 to-game-purple-600 transition-all duration-300"
                    style={{ width: server.status === 'RUNNING' ? '60%' : '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* CPU Usage */}
            <div className="pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-400">
              <div className="pixel-corners-xs-content dark:bg-gray-800 bg-white p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1">
                    <Cpu className="w-3 h-3 dark:text-game-purple-400 text-game-purple-600" />
                    <span className="dark:text-gray-400 text-gray-600 font-medium">CPU</span>
                  </div>
                  <span className="dark:text-white text-gray-900 font-bold">
                    {server.cpuShares ? `${(server.cpuShares / 1024).toFixed(1)}x` : '2x'}
                  </span>
                </div>
                <div className="w-full dark:bg-gray-700 bg-gray-200 h-1.5 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-game-purple-500 to-game-purple-600 transition-all duration-300"
                    style={{ width: server.status === 'RUNNING' ? '45%' : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Connection Info - Only when RUNNING */}
        {server.status === 'RUNNING' && (
          <div className="px-5 pb-4 pt-0">
            {/* Connection Details */}
            <div className="pixel-corners-xs dark:bg-gray-700 bg-gray-200 mb-3">
              <div className="pixel-corners-xs-content dark:bg-gray-900/50 bg-gray-50 p-3 space-y-2">
                {/* IP Address */}
                <div className="flex items-center justify-between text-xs">
                  <span className="dark:text-gray-400 text-gray-600 font-medium flex items-center space-x-1.5">
                    <Terminal className="w-3 h-3" />
                    <span>IP Address</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono dark:text-white text-gray-900 font-bold">{serverIP}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(serverIP);
                      }}
                      className="pixel-corners-xs dark:bg-gray-600 bg-gray-300 transition-all hover:scale-110"
                      title="Copy IP"
                    >
                      <div className="pixel-corners-xs-content dark:bg-gray-700 bg-gray-200 dark:hover:bg-gray-600 hover:bg-gray-100 p-1 transition-colors">
                        <Copy className="w-2.5 h-2.5 dark:text-gray-300 text-gray-600" />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Port */}
                <div className="flex items-center justify-between text-xs">
                  <span className="dark:text-gray-400 text-gray-600 font-medium flex items-center space-x-1.5">
                    <HardDrive className="w-3 h-3" />
                    <span>Port</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono dark:text-white text-gray-900 font-bold">{primaryPort}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(primaryPort.toString());
                      }}
                      className="pixel-corners-xs dark:bg-gray-600 bg-gray-300 transition-all hover:scale-110"
                      title="Copy Port"
                    >
                      <div className="pixel-corners-xs-content dark:bg-gray-700 bg-gray-200 dark:hover:bg-gray-600 hover:bg-gray-100 p-1 transition-colors">
                        <Copy className="w-2.5 h-2.5 dark:text-gray-300 text-gray-600" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {game?.steamGame ? (
                <>
                  <a
                    href={`steam://connect/${serverIP}:${primaryPort}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-600 shadow-game-sm hover:shadow-game transition-all hover:scale-105"
                  >
                    <div className="pixel-corners-xs-content dark:bg-game-purple-600 bg-game-purple-500 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors px-3 py-2.5 flex items-center justify-center space-x-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                      <span className="text-white text-xs font-bold">CONNECT</span>
                    </div>
                  </a>
                  <button
                    onClick={onStop}
                    disabled={isStopping}
                    className="flex-1 pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-600 shadow-game-sm hover:shadow-game disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                  >
                    <div className="pixel-corners-xs-content dark:bg-game-purple-600 bg-game-purple-500 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors px-3 py-2.5 flex items-center justify-center space-x-1.5">
                      {isStopping ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                          <span className="text-white text-xs font-bold">STOPPING</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-white" />
                          <span className="text-white text-xs font-bold">STOP</span>
                        </>
                      )}
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={onStop}
                  disabled={isStopping}
                  className="w-full pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-600 shadow-game-sm hover:shadow-game disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                >
                  <div className="pixel-corners-xs-content dark:bg-game-purple-600 bg-game-purple-500 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors px-3 py-2.5 flex items-center justify-center space-x-1.5">
                    {isStopping ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        <span className="text-white text-xs font-bold">STOPPING</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-white" />
                        <span className="text-white text-xs font-bold">STOP SERVER</span>
                      </>
                    )}
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stopped State */}
        {server.status === 'STOPPED' && (
          <div className="px-5 pb-4">
            <div className="pixel-corners-xs dark:bg-gray-700 bg-gray-200 mb-3">
              <div className="pixel-corners-xs-content dark:bg-gray-900/50 bg-gray-50 p-3 flex items-center justify-center" style={{ minHeight: '72px' }}>
                <div className="flex items-center space-x-2 text-xs">
                  <WifiOff className="w-3 h-3 dark:text-gray-600 text-gray-400" />
                  <span className="dark:text-gray-400 text-gray-600 font-medium">Server is offline</span>
                </div>
              </div>
            </div>
            <button
              onClick={onStart}
              disabled={isStarting}
              className="w-full pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-600 shadow-game-sm hover:shadow-game disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              <div className="pixel-corners-xs-content dark:bg-game-purple-600 bg-game-purple-500 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors px-3 py-2.5 flex items-center justify-center space-x-1.5">
                {isStarting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    <span className="text-white text-xs font-bold">STARTING...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-xs font-bold">START SERVER</span>
                  </>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Creating State */}
        {server.status === 'CREATING' && (
          <div className="px-5 pb-4">
            <div className="pixel-corners-xs dark:bg-game-purple-700 bg-game-purple-400">
              <div className="pixel-corners-xs-content dark:bg-game-purple-900/30 bg-game-purple-50 py-6 px-4">
                <Loader2 className="w-10 h-10 dark:text-game-purple-400 text-game-purple-600 mx-auto mb-3 animate-spin" />
                <p className="text-sm dark:text-game-purple-300 text-game-purple-700 font-bold text-center mb-3">
                  Setting up your server...
                </p>
                <div className="w-full dark:bg-game-purple-800 bg-game-purple-200 h-2 rounded-sm overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-game-purple-400 to-game-purple-600 h-full animate-pulse"
                    style={{ width: '60%' }}
                  />
                </div>
                <p className="text-xs dark:text-game-purple-400 text-game-purple-600 text-center mt-2">
                  This usually takes 1-2 minutes
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {server.status === 'ERROR' && (
          <div className="px-5 pb-4">
            <div className="pixel-corners-xs dark:bg-game-red-700 bg-game-red-400">
              <div className="pixel-corners-xs-content dark:bg-game-red-900/30 bg-game-red-50 py-6 px-4 text-center">
                <AlertCircle className="w-10 h-10 dark:text-game-red-400 text-game-red-600 mx-auto mb-2" />
                <p className="text-sm dark:text-game-red-300 text-game-red-700 font-bold mb-1">
                  Server Error
                </p>
                <p className="text-xs dark:text-game-red-400 text-game-red-600">
                  Something went wrong
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deleting State */}
        {server.status === 'DELETING' && (
          <div className="px-5 pb-4">
            <div className="pixel-corners-xs dark:bg-orange-700 bg-orange-400">
              <div className="pixel-corners-xs-content dark:bg-orange-900/30 bg-orange-50 py-6 text-center">
                <Loader2 className="w-10 h-10 dark:text-orange-400 text-orange-600 mx-auto mb-2 animate-spin" />
                <p className="text-sm dark:text-orange-300 text-orange-700 font-bold">Deleting server...</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 dark:bg-gray-900/50 bg-gray-50 border-t-2 dark:border-gray-700 border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1.5 dark:text-gray-400 text-gray-600">
                <Activity className="w-3 h-3" />
                <span className="font-medium">
                  {server.status === 'RUNNING' ? 'Online 2h 15m' : 'Offline'}
                </span>
              </span>
            </div>
            <ChevronRight className="w-4 h-4 dark:text-gray-500 text-gray-400 group-hover:dark:text-game-green-400 group-hover:text-game-green-600 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
