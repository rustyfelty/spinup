import { useState } from 'react';
import axios from 'axios';
import { StepProps } from '../Setup';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DomainStepProps extends StepProps {}

export default function DomainStep({ onNext, onBack, refreshStatus }: DomainStepProps) {
  // Extract hostname from origin (remove https://)
  const defaultDomain = window.location.origin ? window.location.origin.replace(/^https?:\/\//, '') : '';

  const [webDomain, setWebDomain] = useState(defaultDomain);
  const [apiDomain, setApiDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSeparateApiDomain, setUseSeparateApiDomain] = useState(false);
  const [hasConfiguredCallback, setHasConfiguredCallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Ensure URLs have https:// prefix
  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  // Use webDomain for API if not using separate domain
  const normalizedWebDomain = normalizeUrl(webDomain);
  const normalizedApiDomain = normalizeUrl(apiDomain);
  const effectiveApiDomain = useSeparateApiDomain ? normalizedApiDomain : normalizedWebDomain;
  const redirectUri = effectiveApiDomain ? `${effectiveApiDomain}/api/sso/discord/login/callback` : '';

  const handleContinue = async () => {
    setError(null);

    // Validate URLs
    if (!webDomain.trim()) {
      setError('Domain is required');
      return;
    }

    if (!validateUrl(normalizedWebDomain)) {
      setError('Domain must be a valid URL (e.g., example.com)');
      return;
    }

    // If using separate API domain, validate it
    if (useSeparateApiDomain) {
      if (!apiDomain.trim()) {
        setError('API domain is required');
        return;
      }

      if (!validateUrl(normalizedApiDomain)) {
        setError('API domain must be a valid URL (e.g., api.example.com)');
        return;
      }
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/setup/configure-domains`, {
        webDomain: normalizedWebDomain,
        apiDomain: effectiveApiDomain
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
    <div className="space-y-8">
      {/* Domain Configuration */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-3 leading-relaxed">
          Configure Domain
        </h3>
        <p className="text-slate-300 dark:text-slate-400 text-base leading-relaxed">
          Enter the public URL where your SpinUp installation is accessible.
        </p>
      </div>

      <div className="space-y-5">
        {/* Web Domain */}
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">
            Domain <span className="text-red-500">*</span>
          </label>

          {/* Input group with pixel corners */}
          <div className="pixel-corners-sm bg-gray-600/50">
            <div className="pixel-corners-sm-content bg-slate-800/50 backdrop-blur-sm flex items-stretch overflow-hidden">
              <div className="flex items-center px-3 bg-slate-700/50 border-r-2 border-slate-600">
                <span className="text-slate-400 text-sm font-mono font-bold">https://</span>
              </div>
              <input
                type="text"
                value={webDomain}
                onChange={(e) => setWebDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-4 py-2.5 bg-transparent text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-game-purple-500"
                required
                aria-label="Web domain"
              />
            </div>
          </div>

          <p className="text-slate-500 text-xs mt-2 ml-1">
            The public URL where SpinUp is accessible
          </p>
        </div>

        {/* Simple Checkbox Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useSeparateApiDomain"
            checked={useSeparateApiDomain}
            onChange={(e) => setUseSeparateApiDomain(e.target.checked)}
            className="w-4 h-4 accent-game-purple-600 focus:ring-2 focus:ring-game-purple-500 cursor-pointer"
          />
          <label htmlFor="useSeparateApiDomain" className="text-sm text-slate-400 cursor-pointer">
            Use a different API domain (advanced)
          </label>
        </div>

        {/* API Domain - only show if checkbox is checked */}
        {useSeparateApiDomain && (
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              API Domain <span className="text-red-500">*</span>
            </label>

            {/* Input group with pixel corners */}
            <div className="pixel-corners-sm bg-gray-600/50">
              <div className="pixel-corners-sm-content bg-slate-800/50 backdrop-blur-sm flex items-stretch overflow-hidden">
                <div className="flex items-center px-3 bg-slate-700/50 border-r-2 border-slate-600">
                  <span className="text-slate-400 text-sm font-mono font-bold">https://</span>
                </div>
                <input
                  type="text"
                  value={apiDomain}
                  onChange={(e) => setApiDomain(e.target.value)}
                  placeholder="api.example.com"
                  className="flex-1 px-4 py-2.5 bg-transparent text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-game-purple-500"
                  required
                  aria-label="API domain"
                />
              </div>
            </div>

            <p className="text-slate-500 text-xs mt-2 ml-1">
              The public URL where your API is accessible
            </p>
          </div>
        )}
      </div>

      {/* Discord Prerequisites */}
      <div className="pixel-corners bg-purple-600/30 backdrop-blur-sm">
        <div className="pixel-corners-content bg-gradient-to-br from-purple-950/50 to-indigo-950/50 backdrop-blur-sm p-6">

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="text-4xl flex-shrink-0">🎯</div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-purple-200 mb-2 leading-relaxed">
              Discord Application Setup Required
            </h4>
            <p className="text-sm text-purple-300 leading-relaxed">
              Before continuing, you must create and configure a Discord application.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3">

            {/* Step 1 */}
            <div className="pixel-corners-sm bg-purple-600/30">
              <div className="pixel-corners-sm-content bg-slate-800/50 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl flex-shrink-0">📝</span>
                  <p className="font-bold text-purple-300 text-sm">
                    Step 1: Create Discord Application
                  </p>
                </div>
                <ol className="list-decimal list-inside space-y-2 ml-2 text-slate-300">
                  <li>
                    Go to{' '}
                    <a
                      href="https://discord.com/developers/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-corners-xs bg-purple-600 inline-block hover:shadow-lg hover:shadow-purple-600/30 transition-all"
                    >
                      <span className="pixel-corners-xs-content bg-purple-700 px-2 py-0.5 inline-block hover:bg-purple-600 transition-colors">
                        <span className="text-white font-bold text-xs">Discord Developer Portal ↗</span>
                      </span>
                    </a>
                  </li>
                  <li>Click <strong className="text-white">"New Application"</strong></li>
                  <li>Enter a name (e.g., "SpinUp") and click <strong className="text-white">"Create"</strong></li>
                </ol>
              </div>
            </div>

            {/* Step 2 with improved copy button */}
            <div className="pixel-corners-sm bg-purple-600/30">
              <div className="pixel-corners-sm-content bg-slate-800/50 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl flex-shrink-0">🔗</span>
                  <p className="font-bold text-purple-300 text-sm">
                    Step 2: Configure OAuth Redirect URI
                  </p>
                </div>
                <ol className="list-decimal list-inside space-y-3 ml-2 text-slate-300">
                  <li>In your application, go to <strong className="text-white">OAuth2</strong> → <strong className="text-white">General</strong></li>
                  <li>Scroll to the <strong className="text-white">"Redirects"</strong> section</li>
                  <li>Click <strong className="text-white">"Add Redirect"</strong></li>
                  <li className="list-none -ml-2">
                    <span className="text-slate-300">Copy and paste this URL:</span>

                    {/* Enhanced copy-paste box */}
                    <div className="mt-2 pixel-corners-xs bg-black/50">
                      <div className="pixel-corners-xs-content bg-black/70 backdrop-blur-sm p-3 flex items-center justify-between gap-3">
                        <code className="text-game-purple-400 font-mono text-xs break-all flex-1 leading-relaxed">
                          {redirectUri || 'https://your-domain.com/api/sso/discord/login/callback'}
                        </code>
                        {redirectUri && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(redirectUri);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="pixel-corners-xs bg-game-purple-700 flex-shrink-0 hover:shadow-lg hover:shadow-game-purple-600/30 transition-all"
                            aria-label={copied ? "Copied to clipboard" : "Copy redirect URI to clipboard"}
                          >
                            <div className="pixel-corners-xs-content bg-game-purple-600 px-3 py-1.5 hover:bg-game-purple-500 transition-colors">
                              <span className="text-white font-bold text-xs whitespace-nowrap">
                                {copied ? 'Copied!' : 'Copy'}
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                  <li>Click <strong className="text-white">"Save Changes"</strong> at the bottom</li>
                </ol>
              </div>
            </div>

            {/* Warning box */}
            <div className="pixel-corners-sm bg-amber-600/30 backdrop-blur-sm">
              <div className="pixel-corners-sm-content bg-amber-900/30 backdrop-blur-sm p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <div>
                    <p className="font-bold text-amber-300 text-sm mb-1.5">
                      IMPORTANT:
                    </p>
                    <p className="text-xs text-amber-200 leading-relaxed">
                      Make sure your domains above are correct before copying the redirect URI.
                      The redirect URI in Discord must <strong>exactly match</strong> what's shown.
                    </p>
                  </div>
                </div>
              </div>
            </div>
        </div>
        </div>
      </div>

      {error && (
        <div className="pixel-corners bg-red-600/30 backdrop-blur-sm shadow-lg shadow-red-600/20">
          <div className="pixel-corners-content bg-red-900/30 backdrop-blur-sm p-4">
          <p className="text-red-300 text-sm font-bold">{error}</p>
          </div>
        </div>
      )}

      {/* Confirmation Checkbox */}
      <div className="pixel-corners-sm bg-purple-600/20 backdrop-blur-sm">
        <div className="pixel-corners-sm-content bg-purple-900/20 backdrop-blur-sm p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasConfiguredCallback}
              onChange={(e) => setHasConfiguredCallback(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-game-purple-600 focus:ring-2 focus:ring-game-purple-500 cursor-pointer flex-shrink-0"
              aria-label="Confirm OAuth redirect URI configured"
            />
            <div className="flex-1">
              <span className="text-sm font-bold text-purple-300 block">
                I have configured the OAuth redirect URI in Discord <span className="text-red-400">*</span>
              </span>
              <p className="text-xs text-purple-400 mt-1">
                Confirm that you've added the redirect URI to your Discord application settings
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Improved Navigation Buttons */}
      <div className="flex justify-between gap-4 pt-6 border-t-2 border-slate-700">
        <div className="pixel-corners-sm bg-gray-600/50 hover:shadow-lg hover:shadow-gray-600/20 transition-all">
          <button
            onClick={onBack}
            disabled={loading}
            className="pixel-corners-sm-content bg-slate-700/50 backdrop-blur-sm px-6 py-3 hover:bg-slate-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Go back to previous step"
          >
            <span className="text-white font-bold text-sm">
              ← Back
            </span>
          </button>
        </div>

        <div className="pixel-corners bg-game-purple-600 hover:shadow-lg hover:shadow-game-purple-600/30 transition-all">
          <button
            onClick={handleContinue}
            disabled={loading || !webDomain.trim() || (useSeparateApiDomain && !apiDomain.trim()) || !hasConfiguredCallback}
            className="pixel-corners-content px-8 py-3 bg-gradient-to-r from-game-purple-600 to-game-purple-700 text-white font-bold hover:from-game-purple-700 hover:to-game-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            aria-label="Continue to next step"
          >
            {loading ? '⏳ Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
