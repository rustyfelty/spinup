import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { XCircle, CheckCircle, Activity, Zap, HardDrive } from 'lucide-react';
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
  preset: string;
  region: string;
  autoStart: boolean;
  backups: boolean;
}

const presets = [
  { key: 'vanilla', name: 'Vanilla', description: 'Default game settings' },
  { key: 'hardcore', name: 'Hardcore', description: 'Challenging difficulty' },
  { key: 'creative', name: 'Creative', description: 'Building focused' },
  { key: 'custom', name: 'Custom', description: 'Configure everything' },
];

export default function CreateServerWizard({ orgId, onClose, onSuccess }: CreateServerWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    game: '',
    name: '',
    preset: 'vanilla',
    region: 'us-east',
    autoStart: true,
    backups: true,
  });

  const createServerMutation = useMutation({
    mutationFn: (data: { orgId: string; name: string; gameKey: string }) =>
      serversApi.create(data),
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
    });
  };

  const canProceed = () => {
    if (step === 1) return !!formData.game;
    if (step === 2) return !!formData.name;
    return true;
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
  };

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
                {GAMES.map((game: GameImage) => (
                  <button
                    key={game.key}
                    onClick={() => setFormData({ ...formData, game: game.key })}
                    className={`p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                      formData.game === game.key
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{gameIcons[game.key] || '🎮'}</div>
                    <div className="text-sm font-semibold text-gray-900">{game.name}</div>
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-awesome-server"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Use letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Preset
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setFormData({ ...formData, preset: preset.key })}
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
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
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
                      <div className="text-xs text-gray-500">
                        Automatically restart if the server crashes
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoStart}
                    onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-purple-300 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-gray-900">Automatic backups</div>
                      <div className="text-xs text-gray-500">
                        Daily backups with 7-day retention
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.backups}
                    onChange={(e) => setFormData({ ...formData, backups: e.target.checked })}
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
                <p className="text-sm text-gray-600 mt-2">
                  Confirm your server settings before creation
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Game</span>
                  <span className="font-medium text-gray-900">
                    {GAMES.find((g: GameImage) => g.key === formData.game)?.name}
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
                  <span className="font-medium text-gray-900">
                    {formData.autoStart ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Backups</span>
                  <span className="font-medium text-gray-900">
                    {formData.backups ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start space-x-3">
                  <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">Server will be ready in ~2 minutes</p>
                    <p className="text-blue-700 mt-1">
                      We will download the game files and configure everything automatically
                    </p>
                  </div>
                </div>
              </div>

              {createServerMutation.isError && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-start space-x-3">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-red-900">Failed to create server</p>
                      <p className="text-red-700 mt-1">
                        {createServerMutation.error instanceof Error
                          ? createServerMutation.error.message
                          : 'An error occurred'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
              disabled={createServerMutation.isPending}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <div className="flex items-center space-x-3">
              {step === 4 ? (
                <button
                  onClick={handleCreateServer}
                  disabled={createServerMutation.isPending}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createServerMutation.isPending ? 'Creating...' : 'Create Server'}
                </button>
              ) : (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
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
