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
    // Prevent double execution in strict mode
    let isMounted = true;
    const abortController = new AbortController();

    const fetchGuilds = async () => {
      if (!isMounted) return;

      setFetchingGuilds(true);
      setError(null);

      try {
        const response = await axios.post(`${API_URL}/api/setup/discord/guilds`, {
          sessionToken
        }, {
          signal: abortController.signal
        });

        if (isMounted) {
          setGuilds(response.data.guilds || []);
        }
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return;
        }

        if (isMounted) {
          let errorMessage = err.response?.data?.message || 'Failed to fetch Discord servers';

          // Handle rate limiting with user-friendly message
          if (err.response?.status === 429) {
            const retryAfter = err.response?.data?.retryAfter || 60;
            errorMessage = `Discord API rate limit reached. Please wait ${retryAfter} seconds and try again. This usually happens if you've been rapidly switching between setup steps.`;
          }

          setError(errorMessage);
          console.error('Failed to fetch guilds:', err);
        }
      } finally {
        if (isMounted) {
          setFetchingGuilds(false);
        }
      }
    };

    fetchGuilds();

    // Cleanup function
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [sessionToken]);


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
        <div className="w-16 h-16 border-4 dark:border-game-green-400 border-game-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="dark:text-gray-400 text-gray-600 font-bold">Loading your Discord servers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Buttons */}
      <div className="flex gap-3 pb-4 border-b-2 dark:border-gray-700 border-gray-300">
        <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
          <button
            onClick={onBack}
            className="pixel-corners-sm-content px-4 py-2 dark:hover:bg-gray-700 hover:bg-gray-100 transition-colors dark:text-white text-gray-900 font-bold"
          >
            Back
          </button>
        </div>
        <div className="pixel-corners-sm border-game-green-800">
          <button
            onClick={handleSelectGuild}
            disabled={loading || !selectedGuildId}
            className="pixel-corners-sm-content px-4 py-2 bg-gradient-to-r from-game-green-600 to-game-green-700 text-white shadow-game-light hover:shadow-game disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 font-bold"
          >
            {loading ? 'Connecting...' : 'Continue'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold dark:text-white text-gray-900 mb-2">
          Select Your Discord Server
        </h3>
        <p className="dark:text-gray-400 text-gray-600 mb-4">
          Choose which Discord server you want to connect with SpinUp.
        </p>

        <div className="pixel-corners-sm dark:bg-green-800 bg-green-200 mb-4">
          <div className="pixel-corners-sm-content dark:bg-green-900/20 bg-green-50 p-4">
          <p className="text-sm dark:text-green-300 text-green-800">
            Logged in as <strong>{user.username}#{user.discriminator}</strong>
          </p>
          </div>
        </div>
      </div>

      {guilds.length > 0 ? (
        <div className="space-y-3">
          {guilds.map((guild) => (
            <div className={`pixel-corners-sm ${
              selectedGuildId === guild.id
                ? 'border-game-green-600'
                : 'dark:border-gray-700 border-gray-200'
            }`}>
              <button
                key={guild.id}
                onClick={() => setSelectedGuildId(guild.id)}
                className={`pixel-corners-sm-content w-full p-4 text-left transition-all shadow-game-sm hover:scale-105 ${
                  selectedGuildId === guild.id
                    ? 'dark:bg-game-green-900/20 bg-game-green-50'
                    : 'dark:hover:border-gray-600 hover:border-gray-300'
                }`}
              >
              <div className="flex items-center gap-4">
                {getGuildIconUrl(guild) ? (
                  <img
                    src={getGuildIconUrl(guild)!}
                    alt={guild.name}
                    className="w-12 h-12 rounded-full border-2 dark:border-gray-700 border-gray-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold border-2 border-purple-600">
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold dark:text-white text-gray-900">{guild.name}</p>
                  {guild.owner && (
                    <p className="text-sm dark:text-yellow-400 text-yellow-600">👑 Owner</p>
                  )}
                </div>
                {selectedGuildId === guild.id && (
                  <div className="dark:text-game-green-400 text-game-green-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="pixel-corners-sm dark:bg-yellow-800 bg-yellow-200">
          <div className="pixel-corners-sm-content dark:bg-yellow-900/20 bg-yellow-50 p-4">
          <p className="text-sm dark:text-yellow-300 text-yellow-800 mb-4">
            We couldn't find any servers where you're an owner or administrator. Please enter your Discord Server ID manually.
          </p>
          <input
            type="text"
            value={selectedGuildId || ''}
            onChange={(e) => setSelectedGuildId(e.target.value)}
            placeholder="Discord Server ID (e.g., 1234567890123456789)"
            className="w-full px-4 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs dark:text-gray-500 text-gray-500 mt-2">
            Right-click your server in Discord and click "Copy Server ID" (Developer Mode must be enabled)
          </p>
          </div>
        </div>
      )}

      {error && (
        <div className="pixel-corners-sm dark:bg-game-red-900 bg-game-red-400">
          <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-4">
          <p className="dark:text-game-red-500 text-game-red-900 text-sm font-bold">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
