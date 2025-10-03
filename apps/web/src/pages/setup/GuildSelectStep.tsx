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

export default function GuildSelectStep({ onNext, onBack, refreshStatus }: StepProps) {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInProgress, setAuthInProgress] = useState(false);

  useEffect(() => {
    // Check if we're returning from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string) => {
    setAuthInProgress(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/setup/discord/callback`, {
        params: { code, state }
      });

      setUser(response.data.user);

      // Fetch user's guilds
      await fetchUserGuilds(response.data.sessionToken);

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to authenticate with Discord';

      // Clean up URL and show error
      window.history.replaceState({}, '', window.location.pathname);
      setError(errorMessage);
      setAuthInProgress(false);
    }
  };

  const fetchUserGuilds = async (sessionToken: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/setup/discord/guilds`, {
        sessionToken
      });

      setGuilds(response.data.guilds || []);
    } catch (err: any) {
      // For now, since guild fetching isn't fully implemented,
      // we'll show a manual guild ID input
      console.error('Guild fetch not implemented:', err);
    }
  };

  const handleStartAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/setup/discord/auth-url`);
      window.location.href = response.data.url;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate OAuth URL');
      setLoading(false);
    }
  };

  const handleSelectGuild = async () => {
    if (!selectedGuildId) {
      setError('Please select a Discord server');
      return;
    }

    if (!user) {
      setError('User information missing. Please authenticate again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_URL}/api/setup/select-guild`, {
        guildId: selectedGuildId,
        installerDiscordId: user.id
      });

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

  if (authInProgress) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Authenticating with Discord...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Login with Discord
          </h3>
          <p className="text-gray-600 mb-4">
            You'll need to log in with Discord to select which server SpinUp should manage.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You must be the owner or administrator of the Discord server
              you want to connect.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleStartAuth}
          disabled={loading}
          className="w-full bg-[#5865F2] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {loading ? 'Connecting...' : 'Login with Discord'}
        </button>

        <div className="flex gap-4 pt-4 border-t">
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </div>
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
            We couldn't automatically fetch your servers. Please enter your Discord Server ID manually.
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
