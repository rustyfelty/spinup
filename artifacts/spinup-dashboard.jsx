import React, { useState, useEffect } from 'react';
import { Plus, Server, Gamepad2, ChevronRight, Circle, Wifi, WifiOff, Settings, Terminal, HardDrive, Activity, Clock, Users, Globe, Shield, Zap, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Main Dashboard Component
function SpinUpDashboard() {
  const [servers, setServers] = useState([
    { id: '1', name: 'Survival World', gameKey: 'minecraft-java', game: 'Minecraft Java', status: 'RUNNING', players: '12/20', uptime: '3d 14h', port: 25565, cpu: 45, memory: 78, storage: '2.3 GB' },
    { id: '2', name: 'Viking Realm', gameKey: 'valheim', game: 'Valheim', status: 'RUNNING', players: '8/10', uptime: '5d 2h', port: 2456, cpu: 32, memory: 65, storage: '1.8 GB' },
    { id: '3', name: 'Factory Complex', gameKey: 'factorio', game: 'Factorio', status: 'STOPPED', players: '0/16', uptime: '-', port: 34197, cpu: 0, memory: 0, storage: '890 MB' },
    { id: '4', name: 'Zombie Survival', gameKey: 'zomboid', game: 'Project Zomboid', status: 'CREATING', players: '-', uptime: '-', port: 16261, cpu: 0, memory: 0, storage: '-' },
    { id: '5', name: 'Dino Island', gameKey: 'ark', game: 'ARK: Survival', status: 'ERROR', players: '-', uptime: '-', port: 7777, cpu: 0, memory: 0, storage: '4.2 GB' },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const statusColors = {
    RUNNING: 'text-green-500 bg-green-50 border-green-200',
    STOPPED: 'text-gray-500 bg-gray-50 border-gray-200',
    CREATING: 'text-blue-500 bg-blue-50 border-blue-200',
    ERROR: 'text-red-500 bg-red-50 border-red-200'
  };

  const statusIcons = {
    RUNNING: <CheckCircle className="w-4 h-4" />,
    STOPPED: <XCircle className="w-4 h-4" />,
    CREATING: <Loader2 className="w-4 h-4 animate-spin" />,
    ERROR: <AlertCircle className="w-4 h-4" />
  };

  const filteredServers = servers.filter(server => {
    const matchesFilter = filterStatus === 'all' || server.status === filterStatus;
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          server.game.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: servers.length,
    running: servers.filter(s => s.status === 'RUNNING').length,
    stopped: servers.filter(s => s.status === 'STOPPED').length,
    issues: servers.filter(s => s.status === 'ERROR').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                SpinUp
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Terminal className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Shield className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
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
                <Server className="w-6 h-6 text-purple-600" />
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
              {['all', 'RUNNING', 'STOPPED', 'ERROR'].map(status => (
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

        {/* Server Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServers.map(server => (
            <ServerCard 
              key={server.id} 
              server={server} 
              statusColors={statusColors}
              statusIcons={statusIcons}
              onSelect={() => setSelectedServer(server)}
            />
          ))}
        </div>
      </div>

      {/* Create Server Modal */}
      {showCreateModal && (
        <CreateServerWizard onClose={() => setShowCreateModal(false)} />
      )}

      {/* Server Detail Panel */}
      {selectedServer && (
        <ServerDetailPanel 
          server={selectedServer} 
          onClose={() => setSelectedServer(null)}
          statusColors={statusColors}
          statusIcons={statusIcons}
        />
      )}
    </div>
  );
}

// Server Card Component
function ServerCard({ server, statusColors, statusIcons, onSelect }) {
  const gameIcons = {
    'minecraft-java': '⛏️',
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
    'minecraft-bedrock': '⛏️'
  };

  return (
    <div 
      onClick={onSelect}
      className="bg-white rounded-2xl border border-gray-200 hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-[1.02] group"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">{gameIcons[server.gameKey] || '🎮'}</div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">{server.name}</h3>
              <p className="text-sm text-gray-500">{server.game}</p>
            </div>
          </div>
          <div className={`flex items-center space-x-1 px-3 py-1 rounded-full border ${statusColors[server.status]}`}>
            {statusIcons[server.status]}
            <span className="text-xs font-medium">{server.status}</span>
          </div>
        </div>

        {server.status === 'RUNNING' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Players</span>
              <span className="font-medium text-gray-900">{server.players}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Uptime</span>
              <span className="font-medium text-gray-900">{server.uptime}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Port</span>
              <span className="font-mono text-gray-900">{server.port}</span>
            </div>

            {/* Resource Usage Bars */}
            <div className="pt-3 border-t border-gray-100">
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">CPU</span>
                    <span className="text-gray-900">{server.cpu}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${server.cpu}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Memory</span>
                    <span className="text-gray-900">{server.memory}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${server.memory}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {server.status === 'STOPPED' && (
          <div className="text-center py-4">
            <WifiOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Server is offline</p>
          </div>
        )}

        {server.status === 'CREATING' && (
          <div className="text-center py-4">
            <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-blue-600">Setting up server...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
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
      </div>

      <div className="px-6 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3 h-3" />
              <span>{server.storage || '-'}</span>
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// Create Server Wizard Component
function CreateServerWizard({ onClose }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    game: '',
    name: '',
    preset: 'vanilla',
    region: 'us-east',
    autoStart: true,
    backups: true
  });

  const games = [
    { key: 'minecraft-java', name: 'Minecraft (Java)', icon: '⛏️', description: 'The original Java edition', popularity: 95 },
    { key: 'minecraft-bedrock', name: 'Minecraft (Bedrock)', icon: '⛏️', description: 'Cross-platform edition', popularity: 85 },
    { key: 'valheim', name: 'Valheim', icon: '⚔️', description: 'Viking survival', popularity: 82 },
    { key: 'factorio', name: 'Factorio', icon: '🏭', description: 'Factory building', popularity: 78 },
    { key: 'palworld', name: 'Palworld', icon: '🐾', description: 'Creature collector', popularity: 88 },
    { key: 'rust', name: 'Rust', icon: '🔧', description: 'Hardcore survival', popularity: 75 },
    { key: 'zomboid', name: 'Project Zomboid', icon: '🧟', description: 'Zombie apocalypse', popularity: 72 },
    { key: 'ark', name: 'ARK: Survival Evolved', icon: '🦕', description: 'Dinosaur survival', popularity: 70 },
    { key: 'terraria', name: 'Terraria', icon: '🌳', description: '2D adventure', popularity: 68 },
    { key: 'cs2', name: 'Counter-Strike 2', icon: '🔫', description: 'Competitive FPS', popularity: 90 },
    { key: 'satisfactory', name: 'Satisfactory', icon: '⚙️', description: '3D factory builder', popularity: 76 },
    { key: '7dtd', name: '7 Days to Die', icon: '💀', description: 'Zombie survival craft', popularity: 65 }
  ];

  const presets = [
    { key: 'vanilla', name: 'Vanilla', description: 'Default game settings' },
    { key: 'hardcore', name: 'Hardcore', description: 'Challenging difficulty' },
    { key: 'creative', name: 'Creative', description: 'Building focused' },
    { key: 'custom', name: 'Custom', description: 'Configure everything' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Server</h2>
              <p className="text-sm text-gray-600 mt-1">Step {step} of 4</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Choose Your Game</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map(game => (
                  <button
                    key={game.key}
                    onClick={() => setFormData({...formData, game: game.key})}
                    className={`p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                      formData.game === game.key 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{game.icon}</div>
                    <div className="text-sm font-semibold text-gray-900">{game.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{game.description}</div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-600 h-1 rounded-full"
                          style={{ width: `${game.popularity}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Popularity</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="my-awesome-server"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">Use letters, numbers, and hyphens only</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Preset
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {presets.map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => setFormData({...formData, preset: preset.key})}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.preset === preset.key
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Region
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="us-east">US East (Virginia)</option>
                  <option value="us-west">US West (Oregon)</option>
                  <option value="eu-west">EU West (Ireland)</option>
                  <option value="ap-south">Asia Pacific (Singapore)</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-300 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-gray-900">Auto-start on crash</div>
                      <div className="text-xs text-gray-500">Automatically restart if the server crashes</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoStart}
                    onChange={(e) => setFormData({...formData, autoStart: e.target.checked})}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-300 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-gray-900">Automatic backups</div>
                      <div className="text-xs text-gray-500">Daily backups with 7-day retention</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.backups}
                    onChange={(e) => setFormData({...formData, backups: e.target.checked})}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Review Your Configuration</h3>
                <p className="text-sm text-gray-600 mt-2">Confirm your server settings before creation</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Game</span>
                  <span className="font-medium text-gray-900">
                    {games.find(g => g.key === formData.game)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Server Name</span>
                  <span className="font-medium text-gray-900">{formData.name || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Preset</span>
                  <span className="font-medium text-gray-900 capitalize">{formData.preset}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Region</span>
                  <span className="font-medium text-gray-900">{formData.region}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Auto-restart</span>
                  <span className="font-medium text-gray-900">{formData.autoStart ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Backups</span>
                  <span className="font-medium text-gray-900">{formData.backups ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start space-x-3">
                  <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Server will be ready in ~2 minutes</p>
                    <p className="text-blue-700 mt-1">We'll download the game files and configure everything automatically</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            
            <div className="flex items-center space-x-3">
              {step === 4 ? (
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
                >
                  Create Server
                </button>
              ) : (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !formData.game || step === 2 && !formData.name}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Server Detail Panel Component
function ServerDetailPanel({ server, onClose, statusColors, statusIcons }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">{server.gameKey === 'minecraft-java' ? '⛏️' : '🎮'}</div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{server.name}</h2>
                <div className="flex items-center space-x-3 mt-2">
                  <div className={`flex items-center space-x-1 px-3 py-1 rounded-full border ${statusColors[server.status]}`}>
                    {statusIcons[server.status]}
                    <span className="text-xs font-medium">{server.status}</span>
                  </div>
                  <span className="text-sm text-gray-600">{server.game}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 mt-6">
            <button className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center space-x-2">
              <Wifi className="w-4 h-4" />
              <span>Start</span>
            </button>
            <button className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center space-x-2">
              <WifiOff className="w-4 h-4" />
              <span>Stop</span>
            </button>
            <button className="px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors flex items-center space-x-2">
              <Loader2 className="w-4 h-4" />
              <span>Restart</span>
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-6 mt-6">
            {['overview', 'config', 'console', 'files', 'backups'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-purple-500 text-purple-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Connection Info</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Server Address</span>
                      <code className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">192.168.1.100:{server.port}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Game Version</span>
                      <span className="font-medium">1.20.4</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Players Online</span>
                      <span className="font-medium">{server.players}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                      <Terminal className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-600">Console</span>
                    </button>
                    <button className="p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                      <HardDrive className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-600">Backup</span>
                    </button>
                    <button className="p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                      <Globe className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-600">Whitelist</span>
                    </button>
                    <button className="p-3 bg-white rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                      <Users className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                      <span className="text-xs text-gray-600">Players</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Resource Usage</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">CPU Usage</span>
                        <span className="font-medium">{server.cpu}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${server.cpu}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Memory Usage</span>
                        <span className="font-medium">{server.memory}% (1.6 GB / 2 GB)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-3 rounded-full transition-all"
                          style={{ width: `${server.memory}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Storage</span>
                        <span className="font-medium">{server.storage} / 10 GB</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all"
                          style={{ width: '23%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Server started</p>
                        <p className="text-xs text-gray-500">2 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Backup completed</p>
                        <p className="text-xs text-gray-500">1 hour ago</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Configuration updated</p>
                        <p className="text-xs text-gray-500">3 hours ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <MinecraftConfigEditor />
          )}
        </div>
      </div>
    </div>
  );
}

// Minecraft Config Editor Component
function MinecraftConfigEditor() {
  const [config, setConfig] = useState({
    level_name: 'world',
    difficulty: 'normal',
    max_players: 20,
    online_mode: 'true',
    pvp: 'true',
    motd: 'A Minecraft Server',
    gamemode: 'survival',
    spawn_protection: 16,
    view_distance: 10,
    simulation_distance: 10
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field, value) => {
    setConfig({ ...config, [field]: value });
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Unsaved Changes</p>
                <p className="text-sm text-yellow-700 mt-1">Your configuration changes require a server restart to take effect</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setHasChanges(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Discard
              </button>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700">
                Save & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">World Settings</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">World Name</label>
            <input
              type="text"
              value={config.level_name}
              onChange={(e) => handleChange('level_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={config.difficulty}
              onChange={(e) => handleChange('difficulty', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="peaceful">Peaceful</option>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Game Mode</label>
            <select
              value={config.gamemode}
              onChange={(e) => handleChange('gamemode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="survival">Survival</option>
              <option value="creative">Creative</option>
              <option value="adventure">Adventure</option>
              <option value="spectator">Spectator</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Distance</label>
            <input
              type="range"
              min="2"
              max="32"
              value={config.view_distance}
              onChange={(e) => handleChange('view_distance', e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>2</span>
              <span className="font-medium text-gray-900">{config.view_distance} chunks</span>
              <span>32</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Server Settings</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Players</label>
            <input
              type="number"
              value={config.max_players}
              onChange={(e) => handleChange('max_players', e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Server Message (MOTD)</label>
            <textarea
              value={config.motd}
              onChange={(e) => handleChange('motd', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-purple-300 cursor-pointer">
              <div>
                <div className="font-medium text-gray-900">Online Mode</div>
                <div className="text-xs text-gray-500">Verify player accounts with Mojang</div>
              </div>
              <input
                type="checkbox"
                checked={config.online_mode === 'true'}
                onChange={(e) => handleChange('online_mode', e.target.checked ? 'true' : 'false')}
                className="w-5 h-5 text-purple-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-purple-300 cursor-pointer">
              <div>
                <div className="font-medium text-gray-900">PvP Enabled</div>
                <div className="text-xs text-gray-500">Allow players to damage each other</div>
              </div>
              <input
                type="checkbox"
                checked={config.pvp === 'true'}
                onChange={(e) => handleChange('pvp', e.target.checked ? 'true' : 'false')}
                className="w-5 h-5 text-purple-600 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpinUpDashboard;