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

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

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
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Configure Domain Settings
        </h3>
        <p className="text-gray-600 mb-4">
          Enter the public domain names where your SpinUp installation is accessible. These will be used for Discord OAuth callbacks and magic links.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Make sure your DNS records point to this server and SSL certificates are configured before proceeding.
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
            The public URL where your web app is accessible (detected: {window.location.origin})
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
            The public URL where your API is accessible (usually the same as web domain)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> These settings will be used for Discord OAuth redirect URLs. You'll need to update your Discord application settings to match.
        </p>
      </div>

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
