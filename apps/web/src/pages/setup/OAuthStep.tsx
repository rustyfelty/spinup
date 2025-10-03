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

interface OAuthStepProps extends StepProps {
  onOAuthComplete: (sessionToken: string, user: DiscordUser, guildId?: string) => void;
}

export default function OAuthStep({ onNext, onBack, onOAuthComplete }: OAuthStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInProgress, setAuthInProgress] = useState(false);

  useEffect(() => {
    // Check if we're returning from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      console.log('[OAuth] Processing callback with code and state');
      handleOAuthCallback(code, state);
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string) => {
    console.log('[OAuth] Starting callback handler');
    setAuthInProgress(true);
    setError(null);

    try {
      // Extract guild_id from URL params (Discord sends this on bot authorization)
      const urlParams = new URLSearchParams(window.location.search);
      const guild_id = urlParams.get('guild_id');

      // Build params object
      const params: any = { code, state };
      if (guild_id) {
        params.guild_id = guild_id;
      }

      console.log('[OAuth] Calling API:', `${API_URL}/api/setup/discord/callback`, params);
      const response = await axios.get(`${API_URL}/api/setup/discord/callback`, {
        params
      });

      console.log('[OAuth] Success:', response.data);
      const { sessionToken, user, guildId } = response.data;

      // Store session token, user info, and optional guild ID in parent component
      onOAuthComplete(sessionToken, user, guildId);

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);

      // Move to next step
      onNext();
    } catch (err: any) {
      console.error('[OAuth] Error:', err);
      console.error('[OAuth] Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || 'Failed to authenticate with Discord';

      // Clean up URL and show error
      window.history.replaceState({}, '', window.location.pathname);
      setError(errorMessage);
      setAuthInProgress(false);
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

  if (authInProgress) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Authenticating with Discord...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Login with Discord
        </h3>
        <p className="text-gray-600 mb-4">
          To get started, you'll need to log in with your Discord account. This allows SpinUp to see which servers you manage.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Important:</strong> You must be the owner or administrator of the Discord server you want to connect.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">What we'll ask for:</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Your Discord user profile (username and avatar)</li>
            <li>List of servers you're in (to select which one to manage)</li>
            <li>Your roles in selected server (to configure permissions)</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-semibold mb-2">{error}</p>
          {error.includes('state') && (
            <p className="text-red-600 text-sm">
              This can happen if the login took too long or the server restarted. Please try logging in again.
            </p>
          )}
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
