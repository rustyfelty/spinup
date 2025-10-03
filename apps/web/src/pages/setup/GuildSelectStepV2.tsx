import { useState, useEffect } from 'react';
import axios from 'axios';
import { StepProps } from '../Setup';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface GuildSelectStepV2Props extends StepProps {
  sessionToken: string;
  user: DiscordUser;
  onGuildSelected: (guildId: string) => void;
}

export default function GuildSelectStepV2({
  onNext,
  onBack,
  refreshStatus,
  sessionToken,
  user,
  onGuildSelected
}: GuildSelectStepV2Props) {
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingGuilds, setFetchingGuilds] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserGuilds();
  }, []);

  const fetchUserGuilds = async () => {
    setFetchingGuilds(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/setup/discord/guilds`, {
        sessionToken
      });

      setGuilds(response.data.guilds || []);
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || 'Failed to fetch Discord servers';

      // Handle rate limiting with user-friendly message
      if (err.response?.status === 429) {
        const retryAfter = err.response?.data?.retryAfter || 60;
        errorMessage = `Discord API rate limit reached. Please wait ${retryAfter} seconds and try again. This usually happens if you've been rapidly switching between setup steps.`;
      }

      setError(errorMessage);
      console.error('Failed to fetch guilds:', err);
    } finally {
      setFetchingGuilds(false);
    }
  };

  const handleSelectGuild = async () => {
    if (!selectedGuildId) {
      setError('Please select a Discord server');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: selectedGuildId,
        installerDiscordId: user.id
      });

      // Notify parent about guild selection
      onGuildSelected(selectedGuildId);

      await refreshStatus();
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to select Discord server');
    } finally {
      setLoading(false);
    }
  };

  const getGuildIconUrl = (guild: DiscordGuild) => {
    if (!guild.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  if (fetchingGuilds) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your Discord servers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Select Your Discord Server
        </h3>
        <p className="text-gray-600 mb-4">
          Choose which Discord server you want to connect with SpinUp.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-green-800">
            Logged in as <strong>{user.username}#{user.discriminator}</strong>
          </p>
        </div>
      </div>

      {guilds.length > 0 ? (
        <div className="space-y-3">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              onClick={() => setSelectedGuildId(guild.id)}
              className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                selectedGuildId === guild.id
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                {getGuildIconUrl(guild) ? (
                  <img
                    src={getGuildIconUrl(guild)!}
                    alt={guild.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{guild.name}</p>
                  {guild.owner && (
                    <p className="text-sm text-indigo-600">👑 Owner</p>
                  )}
                </div>
                {selectedGuildId === guild.id && (
                  <div className="text-indigo-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 mb-4">
            We couldn't find any servers where you're an owner or administrator. Please enter your Discord Server ID manually.
          </p>
          <input
            type="text"
            value={selectedGuildId || ''}
            onChange={(e) => setSelectedGuildId(e.target.value)}
            placeholder="Discord Server ID (e.g., 1234567890123456789)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Right-click your server in Discord and click "Copy Server ID" (Developer Mode must be enabled)
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSelectGuild}
          disabled={loading || !selectedGuildId}
          className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Connecting...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
