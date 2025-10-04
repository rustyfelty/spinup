import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { XCircle, CheckCircle, Activity, Zap, HardDrive, Cpu, MemoryStick } from 'lucide-react';
import { serversApi } from '../lib/api';
import { GAMES, type GameImage } from '@spinup/shared';

interface CreateServerWizardProps {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  game: string;
  name: string;
  autoStart: boolean;
  backups: boolean;
  memoryCap: number;
  cpuShares: number;
}

export default function CreateServerWizard({ orgId, onClose, onSuccess }: CreateServerWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    game: '',
    name: '',
    autoStart: true,
    backups: true,
    memoryCap: 2048,
    cpuShares: 2048,
  });
  const [showValidation, setShowValidation] = useState(false);

  const selectedGame = GAMES.find((g: GameImage) => g.key === formData.game);

  const createServerMutation = useMutation({
    mutationFn: (data: {
      orgId: string;
      name: string;
      gameKey: string;
      memoryCap: number;
      cpuShares: number;
    }) => serversApi.create(data),
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleCreateServer = () => {
    if (!formData.game || !formData.name) return;

    createServerMutation.mutate({
      orgId,
      name: formData.name,
      gameKey: formData.game,
      memoryCap: formData.memoryCap,
      cpuShares: formData.cpuShares,
    });
  };

  const canProceed = () => {
    if (step === 1) return !!formData.game;
    if (step === 2) return !!formData.name;
    return true;
  };

  const setResourcePreset = (preset: 'minimum' | 'recommended' | 'maximum') => {
    if (!selectedGame) return;
    const resources = selectedGame.resources[preset];
    if (resources) {
      setFormData({
        ...formData,
        memoryCap: resources.memory,
        cpuShares: resources.cpu,
      });
    }
  };

  // Game icon mapping
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
    'custom': '🔧',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="dark:bg-gray-900/95 bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 dark:border-gray-700 border-b border-gray-200 dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 bg-gradient-to-r from-game-purple-50 to-game-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold dark:text-white text-gray-900">Create New Server</h2>
              <p className="text-sm dark:text-gray-400 text-gray-600 mt-1">Step {step} of 4</p>
            </div>
            <div className="pixel-corners-xs dark:bg-gray-700 bg-gray-300">
              <button
                onClick={onClose}
                className="pixel-corners-xs-content p-2 dark:bg-gray-800 bg-white dark:hover:bg-gray-700 hover:bg-white/50 transition-colors"
              >
                <XCircle className="w-5 h-5 dark:text-gray-400 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="w-full dark:bg-gray-700 bg-gray-200 rounded-full h-3 border-2 dark:border-gray-600 border-gray-400">
              <div
                className="bg-gradient-to-r from-game-purple-500 to-game-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">Choose Your Game</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {GAMES.map((game: GameImage) => (
                  <div
                    key={game.key}
                    className={`pixel-corners ${
                      formData.game === game.key
                        ? 'dark:bg-game-purple-700 bg-game-purple-400'
                        : 'dark:bg-game-purple-700 bg-game-purple-400'
                    }`}
                  >
                    <button
                      onClick={() => setFormData({
                        ...formData,
                        game: game.key,
                        memoryCap: game.resources.recommended.memory,
                        cpuShares: game.resources.recommended.cpu,
                      })}
                      className={`pixel-corners-content p-4 transition-all hover:scale-105 ${
                        formData.game === game.key
                          ? 'dark:bg-game-purple-900/30 bg-gray-50'
                          : 'dark:bg-gray-900/50 bg-gray-50 dark:hover:bg-gray-800/70 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-3xl mb-2">{gameIcons[game.key] || '🎮'}</div>
                      <div className="text-sm font-semibold dark:text-white text-gray-900">{game.name}</div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-2">
                  Server Name <span className="text-game-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (showValidation && e.target.value.trim()) {
                      setShowValidation(false);
                    }
                  }}
                  placeholder="my-awesome-server"
                  className={`w-full px-4 py-3 dark:bg-gray-800 dark:text-white border-2 rounded focus:outline-none focus:ring-2 ${
                    showValidation && !formData.name.trim()
                      ? 'dark:border-game-red-600 border-game-red-500 focus:ring-game-red-500 animate-shake'
                      : formData.name.trim()
                      ? 'dark:border-game-purple-600 border-game-purple-500 focus:ring-game-purple-500'
                      : 'dark:border-gray-700 border-gray-300 focus:ring-game-purple-500'
                  }`}
                />
                {showValidation && !formData.name.trim() ? (
                  <p className="text-xs dark:text-game-red-400 text-game-red-600 mt-2 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Server name is required
                  </p>
                ) : !formData.name.trim() ? (
                  <p className="text-xs dark:text-gray-500 text-gray-500 mt-2">
                    Use letters, numbers, and hyphens only
                  </p>
                ) : (
                  <p className="text-xs dark:text-game-purple-400 text-game-purple-600 mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Valid server name
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-3">
                  Server Options
                </label>
                <div className="space-y-4">
                  <div className={`pixel-corners-sm transition-all ${formData.autoStart ? 'dark:bg-game-purple-700 bg-game-purple-500' : 'dark:bg-game-purple-700 bg-game-purple-400'}`}>
                    <label className={`pixel-corners-sm-content flex items-center justify-between p-4 cursor-pointer transition-colors ${formData.autoStart ? 'dark:bg-game-purple-900/20 bg-gray-50' : 'dark:bg-gray-900/50 bg-gray-50'}`}>
                      <div className="flex items-center space-x-3">
                        <Zap className={`w-5 h-5 ${formData.autoStart ? 'text-game-purple-600 dark:text-game-purple-400' : 'text-game-purple-600 dark:text-game-purple-400'}`} />
                        <div>
                          <div className="font-medium dark:text-white text-gray-900">Auto-start on crash</div>
                          <div className="text-xs dark:text-gray-400 text-gray-500">
                            Automatically restart if the server crashes
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.autoStart}
                        onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                        className="w-5 h-5 accent-game-purple-600 dark:accent-game-purple-500 rounded"
                      />
                    </label>
                  </div>

                  <div className={`pixel-corners-sm transition-all ${formData.backups ? 'dark:bg-game-purple-700 bg-game-purple-500' : 'dark:bg-game-purple-700 bg-game-purple-400'}`}>
                    <label className={`pixel-corners-sm-content flex items-center justify-between p-4 cursor-pointer transition-colors ${formData.backups ? 'dark:bg-game-purple-900/20 bg-gray-50' : 'dark:bg-gray-900/50 bg-gray-50'}`}>
                      <div className="flex items-center space-x-3">
                        <HardDrive className={`w-5 h-5 ${formData.backups ? 'text-game-purple-600 dark:text-game-purple-400' : 'text-game-purple-600 dark:text-game-purple-400'}`} />
                        <div>
                          <div className="font-medium dark:text-white text-gray-900">Automatic backups</div>
                          <div className="text-xs dark:text-gray-400 text-gray-500">
                            Daily backups with 7-day retention
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.backups}
                        onChange={(e) => setFormData({ ...formData, backups: e.target.checked })}
                        className="w-5 h-5 accent-game-purple-600 dark:accent-game-purple-500 rounded"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-4">Resource Allocation</h3>

              {/* Preset buttons */}
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 text-gray-700 mb-3">
                  Choose a preset
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="pixel-corners-sm dark:bg-game-purple-700 bg-game-purple-400 transition-all hover:scale-105">
                    <button
                      onClick={() => setResourcePreset('minimum')}
                      className="pixel-corners-sm-content p-4 dark:bg-gray-900/50 bg-gray-50 text-left w-full"
                    >
                      <div className="font-medium dark:text-white text-gray-900">Minimum</div>
                      <div className="text-xs dark:text-gray-400 text-gray-500 mt-1">
                        {selectedGame?.resources.minimum.description}
                      </div>
                      <div className="text-xs text-game-purple-600 dark:text-game-purple-400 mt-2 font-medium">
                        {selectedGame?.resources.minimum.memory}MB RAM, {selectedGame?.resources.minimum.cpu / 1024} cores
                      </div>
                    </button>
                  </div>

                  <div className="pixel-corners-sm dark:bg-game-purple-700 bg-game-purple-400 transition-all hover:scale-105">
                    <button
                      onClick={() => setResourcePreset('recommended')}
                      className="pixel-corners-sm-content p-4 dark:bg-game-purple-900/30 bg-gray-50 text-left w-full"
                    >
                      <div className="font-medium dark:text-white text-gray-900 flex items-center gap-2">
                        Recommended
                        <span className="text-xs bg-game-purple-600 text-white px-2 py-0.5 rounded-full">Popular</span>
                      </div>
                      <div className="text-xs dark:text-gray-400 text-gray-500 mt-1">
                        {selectedGame?.resources.recommended.description}
                      </div>
                      <div className="text-xs text-game-purple-600 dark:text-game-purple-400 mt-2 font-medium">
                        {selectedGame?.resources.recommended.memory}MB RAM, {selectedGame?.resources.recommended.cpu / 1024} cores
                      </div>
                    </button>
                  </div>

                  {selectedGame?.resources.maximum && (
                    <div className="pixel-corners-sm dark:bg-game-purple-700 bg-game-purple-400 transition-all hover:scale-105">
                      <button
                        onClick={() => setResourcePreset('maximum')}
                        className="pixel-corners-sm-content p-4 dark:bg-gray-900/50 bg-gray-50 text-left w-full"
                      >
                        <div className="font-medium dark:text-white text-gray-900">Maximum</div>
                        <div className="text-xs dark:text-gray-400 text-gray-500 mt-1">
                          {selectedGame.resources.maximum.description}
                        </div>
                        <div className="text-xs text-game-purple-600 dark:text-game-purple-400 mt-2 font-medium">
                          {selectedGame.resources.maximum.memory}MB RAM, {selectedGame.resources.maximum.cpu / 1024} cores
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Memory slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium dark:text-gray-300 text-gray-700 flex items-center gap-2">
                    <MemoryStick className="w-4 h-4" />
                    Memory (RAM)
                  </label>
                  <span className="text-sm font-semibold text-game-purple-600">
                    {formData.memoryCap}MB ({(formData.memoryCap / 1024).toFixed(1)}GB)
                  </span>
                </div>
                <input
                  type="range"
                  min={selectedGame?.resources.minimum.memory || 512}
                  max={selectedGame?.resources.maximum?.memory || 16384}
                  step={512}
                  value={formData.memoryCap}
                  onChange={(e) => setFormData({ ...formData, memoryCap: parseInt(e.target.value) })}
                  className="w-full h-2 dark:bg-gray-700 bg-gray-200 rounded appearance-none cursor-pointer accent-game-purple-600"
                />
                <div className="flex justify-between text-xs dark:text-gray-500 text-gray-500 mt-1">
                  <span>{selectedGame?.resources.minimum.memory}MB</span>
                  <span>{selectedGame?.resources.maximum?.memory || 16384}MB</span>
                </div>
              </div>

              {/* CPU slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium dark:text-gray-300 text-gray-700 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    CPU Cores
                  </label>
                  <span className="text-sm font-semibold text-game-purple-600">
                    {(formData.cpuShares / 1024).toFixed(1)} cores
                  </span>
                </div>
                <input
                  type="range"
                  min={selectedGame?.resources.minimum.cpu || 1024}
                  max={selectedGame?.resources.maximum?.cpu || 8192}
                  step={1024}
                  value={formData.cpuShares}
                  onChange={(e) => setFormData({ ...formData, cpuShares: parseInt(e.target.value) })}
                  className="w-full h-2 dark:bg-gray-700 bg-gray-200 rounded appearance-none cursor-pointer accent-game-purple-600"
                />
                <div className="flex justify-between text-xs dark:text-gray-500 text-gray-500 mt-1">
                  <span>{(selectedGame?.resources.minimum.cpu || 1024) / 1024} cores</span>
                  <span>{(selectedGame?.resources.maximum?.cpu || 8192) / 1024} cores</span>
                </div>
              </div>

              {/* Performance estimate */}
              {selectedGame?.scaling && (
                <div className="pixel-corners-sm dark:bg-game-purple-600 bg-game-purple-300">
                  <div className="pixel-corners-sm-content p-4 dark:bg-game-purple-900/30 bg-gray-50">
                    <div className="flex items-start space-x-3">
                      <Activity className="w-5 h-5 text-game-purple-600 dark:text-game-purple-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium dark:text-game-purple-300 text-game-purple-900">Estimated Capacity</p>
                        <p className="dark:text-game-purple-400 text-game-purple-700 mt-1">
                          With these resources, your server can support approximately{' '}
                          <span className="font-semibold">
                            {Math.min(
                              Math.floor((formData.memoryCap / 1024) * selectedGame.scaling.playersPerGB),
                              Math.floor((formData.cpuShares / 1024) * selectedGame.scaling.playersPerCore)
                            )}
                          </span>{' '}
                          concurrent players
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-20 h-20 dark:bg-game-purple-900/30 bg-game-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-game-purple-600" />
                </div>
                <h3 className="text-xl font-semibold dark:text-white text-gray-900">Review Your Configuration</h3>
                <p className="text-sm dark:text-gray-400 text-gray-600 mt-2">
                  Confirm your server settings before creation
                </p>
              </div>

              <div className="pixel-corners dark:bg-game-purple-700 bg-game-purple-400">
                <div className="pixel-corners-content dark:bg-gray-800/50 bg-gray-50 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="dark:text-gray-400 text-gray-600">Game</span>
                    <span className="font-medium dark:text-white text-gray-900">
                      {GAMES.find((g: GameImage) => g.key === formData.game)?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="dark:text-gray-400 text-gray-600">Server Name</span>
                    <span className="font-medium dark:text-white text-gray-900">{formData.name || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="dark:text-gray-400 text-gray-600">Auto-restart</span>
                    <span className="font-medium dark:text-white text-gray-900">
                      {formData.autoStart ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="dark:text-gray-400 text-gray-600">Backups</span>
                    <span className="font-medium dark:text-white text-gray-900">
                      {formData.backups ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="border-t dark:border-gray-700 border-gray-200 pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="dark:text-gray-400 text-gray-600 flex items-center gap-2">
                        <MemoryStick className="w-4 h-4" />
                        Memory (RAM)
                      </span>
                      <span className="font-medium dark:text-white text-gray-900">
                        {formData.memoryCap}MB ({(formData.memoryCap / 1024).toFixed(1)}GB)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="dark:text-gray-400 text-gray-600 flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      CPU Cores
                    </span>
                    <span className="font-medium dark:text-white text-gray-900">
                      {(formData.cpuShares / 1024).toFixed(1)} cores
                    </span>
                  </div>
                </div>
              </div>

              <div className="pixel-corners-sm dark:bg-game-purple-600 bg-game-purple-300 mt-6">
                <div className="pixel-corners-sm-content p-4 dark:bg-game-purple-900/30 bg-gray-50">
                  <div className="flex items-start space-x-3">
                    <Activity className="w-5 h-5 text-game-purple-600 dark:text-game-purple-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium dark:text-game-purple-300 text-game-purple-900">Server will be ready in ~2 minutes</p>
                      <p className="dark:text-game-purple-400 text-game-purple-700 mt-1">
                        We will download the game files and configure everything automatically
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {createServerMutation.isError && (
                <div className="pixel-corners-sm dark:bg-game-red-900 bg-game-red-400 mt-4">
                  <div className="pixel-corners-sm-content p-4 dark:bg-red-900/30 bg-red-50">
                    <div className="flex items-start space-x-3">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium dark:text-red-300 text-red-900">Failed to create server</p>
                        <p className="dark:text-red-400 text-red-700 mt-1">
                          {createServerMutation.error instanceof Error
                            ? createServerMutation.error.message
                            : 'An error occurred'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 dark:border-gray-700 border-t border-gray-200 dark:bg-gray-900 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="pixel-corners-sm dark:bg-gray-600 bg-gray-400 disabled:opacity-50">
              <button
                onClick={() => {
                  setShowValidation(false);
                  step > 1 ? setStep(step - 1) : onClose();
                }}
                disabled={createServerMutation.isPending}
                className="pixel-corners-sm-content dark:bg-gray-700 bg-gray-200 px-6 py-2.5 dark:hover:bg-gray-600 hover:bg-gray-300 transition-colors disabled:hover:bg-gray-200 dark:disabled:hover:bg-gray-700"
              >
                <span className="dark:text-white text-gray-900 font-bold text-sm">
                  {step === 1 ? '← Cancel' : '← Back'}
                </span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {step === 4 ? (
                <div className="pixel-corners-sm dark:bg-game-purple-700 bg-game-purple-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-game-light hover:shadow-game transition-all hover:scale-105 active:scale-95">
                  <button
                    onClick={handleCreateServer}
                    disabled={createServerMutation.isPending}
                    className="pixel-corners-sm-content dark:bg-game-purple-600 bg-game-purple-500 px-6 py-2.5 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors disabled:opacity-50"
                  >
                    <span className="text-white font-bold text-sm">
                      {createServerMutation.isPending ? '⏳ Creating...' : 'Create Server →'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="pixel-corners-sm dark:bg-game-purple-700 bg-game-purple-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-game-light hover:shadow-game transition-all hover:scale-105 active:scale-95">
                  <button
                    onClick={() => {
                      if (step === 2 && !formData.name.trim()) {
                        setShowValidation(true);
                        return;
                      }
                      setShowValidation(false);
                      setStep(step + 1);
                    }}
                    disabled={!canProceed()}
                    className="pixel-corners-sm-content dark:bg-game-purple-600 bg-game-purple-500 px-6 py-2.5 dark:hover:bg-game-purple-500 hover:bg-game-purple-400 transition-colors disabled:opacity-50"
                  >
                    <span className="text-white font-bold text-sm">
                      Continue →
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
