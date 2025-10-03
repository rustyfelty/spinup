import { useState } from 'react';
import axios from 'axios';
import { StepProps } from '../Setup';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DomainStepProps extends StepProps {}

export default function DomainStep({ onNext, onBack, refreshStatus }: DomainStepProps) {
  const [webDomain, setWebDomain] = useState(
    window.location.origin || 'https://daboyz.live'
  );
  const [apiDomain, setApiDomain] = useState(
    import.meta.env.VITE_API_URL || 'https://daboyz.live'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const redirectUri = apiDomain ? `${apiDomain}/api/sso/discord/login/callback` : '';

  const handleContinue = async () => {
    setError(null);

    // Validate URLs
    if (!webDomain.trim()) {
      setError('Web domain is required');
      return;
    }

    if (!apiDomain.trim()) {
      setError('API domain is required');
      return;
    }

    if (!validateUrl(webDomain)) {
      setError('Web domain must be a valid URL (e.g., https://daboyz.live)');
      return;
    }

    if (!validateUrl(apiDomain)) {
      setError('API domain must be a valid URL (e.g., https://daboyz.live)');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/setup/configure-domains`, {
        webDomain,
        apiDomain
      });

      await refreshStatus();
      onNext();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save domain configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Discord Prerequisites */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">🎯</div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-blue-900 mb-2">
              Discord Application Setup Required
            </h4>
            <p className="text-sm text-blue-800">
              Before continuing, you must create and configure a Discord application.
            </p>
          </div>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-blue-600 hover:text-blue-800 text-sm font-semibold px-3 py-1 rounded hover:bg-blue-100 transition-colors"
          >
            {showInstructions ? 'Hide' : 'Show'}
          </button>
        </div>

        {showInstructions && (
          <div className="space-y-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-bold text-blue-900 mb-3">📝 Step 1: Create Discord Application</p>
              <ol className="list-decimal list-inside space-y-2 ml-2 text-gray-700">
                <li>
                  Go to{' '}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline hover:text-blue-800 font-semibold"
                  >
                    Discord Developer Portal ↗
                  </a>
                </li>
                <li>Click <strong>"New Application"</strong></li>
                <li>Enter a name (e.g., "SpinUp") and click <strong>"Create"</strong></li>
              </ol>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-bold text-blue-900 mb-3">🔗 Step 2: Configure OAuth Redirect URI</p>
              <ol className="list-decimal list-inside space-y-2 ml-2 text-gray-700">
                <li>In your application, go to <strong>OAuth2</strong> → <strong>General</strong></li>
                <li>Scroll to the <strong>"Redirects"</strong> section</li>
                <li>Click <strong>"Add Redirect"</strong></li>
                <li>
                  Copy and paste this URL:
                  <div className="mt-2 p-3 bg-gray-900 text-green-400 rounded font-mono text-xs break-all flex items-center justify-between gap-2">
                    <span>{redirectUri || 'https://your-domain.com/api/sso/discord/login/callback'}</span>
                    {redirectUri && (
                      <button
                        onClick={() => navigator.clipboard.writeText(redirectUri)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold whitespace-nowrap"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </li>
                <li>Click <strong>"Save Changes"</strong> at the bottom</li>
              </ol>
            </div>

            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-bold text-blue-900 mb-3">🔑 Step 3: Save Your Credentials</p>
              <p className="text-gray-700 mb-2">You'll need these in the next step:</p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                <li><strong>Client ID</strong> - found on the "General Information" page</li>
                <li><strong>Client Secret</strong> - click "Reset Secret" on the OAuth2 page</li>
              </ul>
            </div>

            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-bold text-amber-900 text-xs mb-1">IMPORTANT:</p>
                  <p className="text-xs text-amber-800">
                    Enter your API domain below FIRST, then copy the redirect URI above.
                    The redirect URI in Discord must <strong>exactly match</strong> what's shown above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Domain Configuration */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Configure Domain Settings
        </h3>
        <p className="text-gray-600 mb-4">
          Enter the public URLs where your SpinUp installation is accessible.
        </p>
      </div>

      <div className="space-y-4">
        {/* Web Domain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Web App Domain <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={webDomain}
            onChange={(e) => setWebDomain(e.target.value)}
            placeholder="https://daboyz.live"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          <p className="text-gray-500 text-xs mt-1">
            The public URL where your web app is accessible
          </p>
        </div>

        {/* API Domain */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Domain <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={apiDomain}
            onChange={(e) => setApiDomain(e.target.value)}
            placeholder="https://daboyz.live"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          <p className="text-gray-500 text-xs mt-1">
            The public URL where your API is accessible (usually same as web domain)
          </p>
        </div>

        {/* Show generated redirect URI */}
        {redirectUri && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-900 mb-1">✓ Redirect URI for Discord:</p>
            <code className="text-xs text-green-800 break-all">{redirectUri}</code>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-4 pt-4 border-t">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={loading || !webDomain.trim() || !apiDomain.trim()}
          className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
