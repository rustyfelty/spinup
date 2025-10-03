import { useState } from 'react';
import axios from 'axios';
import { StepProps } from '../Setup';

const API_URL = import.meta.env.VITE_API_URL || '';

interface BotValidationResult {
  valid: boolean;
  botUser?: {
    id: string;
    username: string;
    discriminator: string;
  };
  guilds?: number;
  error?: string;
}

export default function DiscordStep({ onNext, onBack, refreshStatus }: StepProps) {
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [validationResult, setValidationResult] = useState<BotValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!botToken.trim()) {
      setError('Please enter your Discord bot token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/setup/discord/test`, {
        token: botToken
      });

      setValidationResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to validate bot token');
      setValidationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = async () => {
    if (!botToken || !clientId || !clientSecret) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_URL}/api/setup/discord/configure`, {
        botToken,
        clientId,
        clientSecret
      });

      await refreshStatus();
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to configure Discord bot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Create a Discord Bot
        </h3>
        <p className="text-gray-600 mb-4">
          To connect SpinUp with Discord, you'll need to create a bot application.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700 bg-gray-50 p-4 rounded-lg">
          <li>
            Go to{' '}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Discord Developer Portal
            </a>
          </li>
          <li>Click "New Application" and give it a name</li>
          <li>Go to the "Bot" section and click "Add Bot"</li>
          <li>Under "TOKEN", click "Reset Token" and copy it</li>
          <li>Enable "SERVER MEMBERS INTENT" under Privileged Gateway Intents</li>
          <li>Go to "OAuth2" → "General" to get your Client ID and Client Secret</li>
          <li>
            <strong>Important:</strong> In "OAuth2" → "General" → "Redirects", add:{' '}
            <code className="bg-white px-2 py-1 rounded text-sm">
              {window.location.origin}/setup-wizard
            </code>
          </li>
        </ol>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bot Token <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Paste your Discord bot token here"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Keep this secret! Never share your bot token.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your application's Client ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Secret <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Your application's Client Secret"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleValidate}
          disabled={loading || !botToken}
          className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Testing Connection...' : 'Test Bot Connection'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {validationResult?.valid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <p className="font-medium text-green-800">Bot Connected Successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                Bot: <strong>{validationResult.botUser?.username}</strong>
                {validationResult.guilds !== undefined && (
                  <> • In {validationResult.guilds} server(s)</>
                )}
              </p>
            </div>
          </div>
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
          onClick={handleConfigure}
          disabled={loading || !validationResult?.valid || !clientId || !clientSecret}
          className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Configuring...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
