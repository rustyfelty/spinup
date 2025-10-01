import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XCircle,
  Search,
  Server,
  Plus,
  Activity,
  Shield,
  Settings,
  LogOut,
  PlayCircle,
  StopCircle,
  RotateCw,
  Trash2,
  Command,
} from 'lucide-react';
import type { Server as ServerType } from '@spinup/shared';

interface CommandPaletteProps {
  onClose: () => void;
  servers: ServerType[];
  onCreateServer: () => void;
  onStartServer: (id: string) => void;
  onStopServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  onShowHealth: () => void;
  onLogout: () => void;
}

type Command = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
};

export default function CommandPalette({
  onClose,
  servers,
  onCreateServer,
  onStartServer,
  onStopServer,
  onDeleteServer,
  onShowHealth,
  onLogout,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Build command list
  const commands: Command[] = [
    {
      id: 'create-server',
      label: 'Create New Server',
      description: 'Launch a new game server',
      icon: <Plus className="w-4 h-4" />,
      action: () => {
        onClose();
        onCreateServer();
      },
      keywords: ['new', 'add', 'create', 'server'],
    },
    {
      id: 'view-health',
      label: 'View System Health',
      description: 'Check system status and resources',
      icon: <Activity className="w-4 h-4" />,
      action: () => {
        onClose();
        onShowHealth();
      },
      keywords: ['health', 'status', 'monitor', 'system'],
    },
    {
      id: 'security',
      label: 'Security Settings',
      description: 'Manage API keys and security',
      icon: <Shield className="w-4 h-4" />,
      action: () => {
        onClose();
        // TODO: Navigate to security settings
      },
      keywords: ['security', 'api', 'keys', 'settings'],
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Application settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => {
        onClose();
        // TODO: Navigate to settings
      },
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      icon: <LogOut className="w-4 h-4" />,
      action: () => {
        onClose();
        onLogout();
      },
      keywords: ['logout', 'sign out', 'exit'],
    },
  ];

  // Add server-specific commands
  servers.forEach((server) => {
    // View server
    commands.push({
      id: `view-${server.id}`,
      label: `View ${server.name}`,
      description: `Open ${server.name} details`,
      icon: <Server className="w-4 h-4" />,
      action: () => {
        onClose();
        navigate(`/servers/${server.id}`);
      },
      keywords: ['server', 'view', 'open', server.name.toLowerCase()],
    });

    // Start server (if stopped)
    if (server.status === 'STOPPED') {
      commands.push({
        id: `start-${server.id}`,
        label: `Start ${server.name}`,
        description: 'Start this server',
        icon: <PlayCircle className="w-4 h-4 text-green-600" />,
        action: () => {
          onClose();
          onStartServer(server.id);
        },
        keywords: ['start', 'run', 'launch', server.name.toLowerCase()],
      });
    }

    // Stop server (if running)
    if (server.status === 'RUNNING') {
      commands.push({
        id: `stop-${server.id}`,
        label: `Stop ${server.name}`,
        description: 'Stop this server',
        icon: <StopCircle className="w-4 h-4 text-red-600" />,
        action: () => {
          onClose();
          onStopServer(server.id);
        },
        keywords: ['stop', 'halt', server.name.toLowerCase()],
      });
    }

    // Restart server (if running)
    if (server.status === 'RUNNING') {
      commands.push({
        id: `restart-${server.id}`,
        label: `Restart ${server.name}`,
        description: 'Restart this server',
        icon: <RotateCw className="w-4 h-4 text-blue-600" />,
        action: () => {
          onClose();
          onStopServer(server.id);
          setTimeout(() => onStartServer(server.id), 2000);
        },
        keywords: ['restart', 'reboot', server.name.toLowerCase()],
      });
    }

    // Delete server
    commands.push({
      id: `delete-${server.id}`,
      label: `Delete ${server.name}`,
      description: 'Permanently delete this server',
      icon: <Trash2 className="w-4 h-4 text-red-600" />,
      action: () => {
        if (confirm(`Are you sure you want to delete ${server.name}?`)) {
          onClose();
          onDeleteServer(server.id);
        }
      },
      keywords: ['delete', 'remove', server.name.toLowerCase()],
    });
  });

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    const matchesLabel = cmd.label.toLowerCase().includes(searchLower);
    const matchesDescription = cmd.description?.toLowerCase().includes(searchLower);
    const matchesKeywords = cmd.keywords?.some((kw) => kw.includes(searchLower));
    return matchesLabel || matchesDescription || matchesKeywords;
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredCommands, onClose]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-32">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 outline-none text-gray-900 placeholder-gray-400"
            autoFocus
          />
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">ESC</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Command List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <Command className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? 'bg-purple-50 border-l-4 border-purple-500'
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 mr-3">
                    {cmd.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{cmd.label}</div>
                    {cmd.description && (
                      <div className="text-sm text-gray-500">{cmd.description}</div>
                    )}
                  </div>
                  {index === selectedIndex && (
                    <kbd className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-300">
                      ↵
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}
