import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, authApi } from '../lib/api'
import ThemeToggle from '../components/ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'

export default function Settings() {
  const navigate = useNavigate()
  const { primaryColor, updatePrimaryColor, resetColor } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [webDomain, setWebDomain] = useState('')
  const [apiDomain, setApiDomain] = useState('')

  // Check user permissions
  const { data: authData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
  })

  // Redirect if user doesn't have admin access
  useEffect(() => {
    if (authData && authData.role !== 'OWNER' && authData.role !== 'ADMIN' && !authData.isDiscordOwner) {
      navigate('/')
    }
  }, [authData, navigate])

  // Reset confirmation dialog state
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetConfirmName, setResetConfirmName] = useState('')
  const [guildName, setGuildName] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    loadSettings()
    loadGuildInfo()
  }, [])

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/api/settings')
      // Strip https:// prefix for display
      setWebDomain((data.webDomain || '').replace(/^https?:\/\//, ''))
      setApiDomain((data.apiDomain || '').replace(/^https?:\/\//, ''))
    } catch (err: any) {
      setError('Failed to load settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadGuildInfo = async () => {
    try {
      const { data } = await api.get('/api/setup/org-info')
      setGuildName(data.discordGuildName || '')
    } catch (err) {
      console.error('Failed to load guild info:', err)
    }
  }

  const handleResetSetup = async () => {
    if (!resetConfirmName.trim()) {
      setResetError('Please enter the confirmation text')
      return
    }

    if (resetConfirmName !== 'RESET-SYSTEM-COMPLETELY') {
      setResetError('Confirmation text does not match. Please type exactly: RESET-SYSTEM-COMPLETELY')
      return
    }

    setResetting(true)
    setResetError('')

    try {
      await api.post('/api/setup/reset', {
        confirmationToken: resetConfirmName
      })

      // Set token in session storage to allow setup wizard access
      sessionStorage.setItem('setup_reset_token', 'true')

      // Redirect to setup wizard
      window.location.href = '/setup'
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'Failed to reset setup')
      setResetting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      // Add https:// prefix before saving
      const fullWebDomain = webDomain.startsWith('http') ? webDomain : `https://${webDomain}`
      const fullApiDomain = apiDomain.startsWith('http') ? apiDomain : `https://${apiDomain}`

      await api.patch('/api/settings', {
        webDomain: fullWebDomain,
        apiDomain: fullApiDomain
      })

      setSuccess('Settings saved successfully! Reload the page for changes to take effect.')
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="dark:text-white text-gray-900 font-bold">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100">
      {/* Header */}
      <header className="dark:bg-gray-800/80 bg-white/90 backdrop-blur-md dark:border-gray-700 border-b-2 border-gray-300 sticky top-0 z-40 shadow-game-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
              <button
                onClick={() => navigate('/')}
                className="pixel-corners-sm-content px-3 sm:px-4 py-2 dark:text-gray-300 text-gray-700 dark:hover:text-white hover:text-black transition dark:hover:bg-gray-700 hover:bg-gray-100 text-sm sm:text-base whitespace-nowrap shadow-game-sm"
              >
                ← Back
              </button>
            </div>
            <h1 className="text-base sm:text-lg md:text-xl font-pixel dark:text-white text-gray-900 truncate">Admin Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Theme Colors Section */}
        <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 mb-6">
          <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm shadow-game overflow-hidden">
          <div className="p-6 border-b-2 dark:border-gray-700 border-gray-300">
            <h2 className="text-lg font-pixel dark:text-white text-gray-900">Theme Colors</h2>
            <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">
              Customize the color scheme of your SpinUp installation
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Primary Color */}
            <div>
              <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="pixel-corners-sm dark:border-gray-600 border-gray-300">
                <div className="pixel-corners-sm-content flex items-stretch overflow-hidden dark:bg-gray-800 bg-white">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => updatePrimaryColor(e.target.value)}
                    className="w-16 cursor-pointer dark:bg-gray-700 bg-gray-100 border-r-2 dark:border-gray-600 border-gray-300"
                    style={{ padding: '0', height: '48px' }}
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => updatePrimaryColor(e.target.value)}
                    placeholder="#5865F2"
                    className="flex-1 px-4 py-3 dark:bg-gray-700 bg-white dark:text-white text-gray-900 dark:placeholder-gray-400 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-game-primary-500 focus:ring-inset font-mono"
                  />
                </div>
              </div>
              <p className="dark:text-gray-400 text-gray-600 text-sm mt-2">
                This color is used for buttons, borders, icons, and all interactive elements across the site
              </p>
            </div>

            {/* Reset Button */}
            <div className="pt-4">
              <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto inline-block">
                <button
                  type="button"
                  onClick={resetColor}
                  className="pixel-corners-sm-content px-4 sm:px-6 py-2 dark:bg-gray-700 bg-gray-300 dark:hover:bg-gray-600 hover:bg-gray-400 dark:text-white text-gray-900 font-bold transition text-sm sm:text-base whitespace-nowrap"
                >
                  Reset to Discord Blurple
                </button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="dark:bg-gray-900/50 bg-gray-50 p-6 border-t-2 dark:border-gray-700 border-gray-300">
            <h3 className="text-sm font-bold dark:text-white text-gray-900 mb-3">How it works:</h3>
            <ul className="text-sm dark:text-gray-400 text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="dark:text-game-primary-400 text-game-primary-600 mt-1">•</span>
                <span>Choose any color and all buttons, borders, and interactive elements will update instantly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-primary-400 text-game-primary-600 mt-1">•</span>
                <span>Use the color picker or enter a hex code (e.g., #9146ff for Twitch purple)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-primary-400 text-game-primary-600 mt-1">•</span>
                <span>Your custom color is saved in your browser and persists across sessions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-primary-400 text-game-primary-600 mt-1">•</span>
                <span>Try bright colors like cyan (#00ffff), pink (#ff00ff), or orange (#ff6600)!</span>
              </li>
            </ul>
          </div>
          </div>
        </div>

        {/* Discord Integration Section */}
        <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 mb-6">
          <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm shadow-game overflow-hidden">
          <div className="p-6 border-b-2 dark:border-gray-700 border-gray-300">
            <h2 className="text-lg font-pixel dark:text-white text-gray-900">Discord Integration</h2>
            <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">
              Manage Discord role permissions and settings
            </p>
          </div>

          <div className="p-6">
            <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 mb-4">
              <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-4">
              <p className="text-sm dark:text-gray-300 text-gray-700 mb-4">
                Configure which Discord roles have access to different features in SpinUp. The Server Owner always has full access to all features.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="pixel-corners-sm dark:bg-game-primary-600 bg-game-primary-500 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto">
                  <button
                    onClick={() => navigate('/discord-roles')}
                    className="pixel-corners-sm-content w-full sm:w-auto px-4 sm:px-6 py-2 dark:bg-game-primary-600 bg-game-primary-500 hover:bg-game-primary-700 dark:hover:bg-game-primary-500 text-white text-sm sm:text-base font-bold transition whitespace-nowrap"
                  >
                    Manage Roles
                  </button>
                </div>
                <div className="pixel-corners-sm bg-game-red-700 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto">
                  <button
                    onClick={() => setShowResetDialog(true)}
                    className="pixel-corners-sm-content w-full sm:w-auto px-4 sm:px-6 py-2 bg-game-red-700 hover:bg-game-red-800 text-white text-sm sm:text-base font-bold transition whitespace-nowrap"
                  >
                    Change Server
                  </button>
                </div>
              </div>
              </div>
            </div>

            {/* Warning about changing server */}
            <div className="pixel-corners-sm dark:border-yellow-800 border-yellow-300">
              <div className="pixel-corners-sm-content dark:bg-yellow-900/20 bg-yellow-50 p-4">
                <p className="text-sm dark:text-yellow-300 text-yellow-800">
                  <strong>Warning:</strong> Changing your Discord server will delete ALL data including servers, backups, and settings. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Domain Configuration Section */}
        <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
          <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white backdrop-blur-sm shadow-game overflow-hidden">
          <div className="p-6 border-b-2 dark:border-gray-700 border-gray-300">
            <h2 className="text-lg font-pixel dark:text-white text-gray-900">Domain Configuration</h2>
            <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">
              Configure the public domain names for your SpinUp installation
            </p>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Web Domain */}
            <div>
              <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-2">
                Web App Domain
              </label>
              <div className="pixel-corners-sm dark:bg-gray-600 bg-gray-400">
                <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white/50 backdrop-blur-sm flex items-stretch overflow-hidden">
                  <div className="flex items-center px-3 dark:bg-gray-700/50 bg-gray-200/50 border-r-2 dark:border-gray-600 border-gray-400">
                    <span className="dark:text-gray-400 text-gray-600 text-sm font-mono font-bold">https://</span>
                  </div>
                  <input
                    type="text"
                    value={webDomain}
                    onChange={(e) => setWebDomain(e.target.value)}
                    placeholder="daboyz.live"
                    className="flex-1 px-4 py-3 bg-transparent dark:text-white text-gray-900 dark:placeholder:text-gray-500 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-game-primary-500"
                    required
                  />
                </div>
              </div>
              <p className="dark:text-gray-400 text-gray-600 text-xs mt-2 ml-1">
                The public URL where your web app is accessible
              </p>
            </div>

            {/* API Domain */}
            <div>
              <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-2">
                API Domain
              </label>
              <div className="pixel-corners-sm dark:bg-gray-600 bg-gray-400">
                <div className="pixel-corners-sm-content dark:bg-gray-800/50 bg-white/50 backdrop-blur-sm flex items-stretch overflow-hidden">
                  <div className="flex items-center px-3 dark:bg-gray-700/50 bg-gray-200/50 border-r-2 dark:border-gray-600 border-gray-400">
                    <span className="dark:text-gray-400 text-gray-600 text-sm font-mono font-bold">https://</span>
                  </div>
                  <input
                    type="text"
                    value={apiDomain}
                    onChange={(e) => setApiDomain(e.target.value)}
                    placeholder="api.daboyz.live"
                    className="flex-1 px-4 py-3 bg-transparent dark:text-white text-gray-900 dark:placeholder:text-gray-500 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-game-primary-500"
                    required
                  />
                </div>
              </div>
              <p className="dark:text-gray-400 text-gray-600 text-xs mt-2 ml-1">
                The public URL where your API is accessible
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="pixel-corners-sm dark:border-game-red-900 border-game-red-400">
                <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-4">
                  <p className="dark:text-game-red-500 text-game-red-900 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="pixel-corners-sm dark:border-green-800 border-green-300">
                <div className="pixel-corners-sm-content dark:bg-green-900/20 bg-green-50 p-4">
                  <p className="dark:text-green-400 text-green-800 text-sm">{success}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <div className="pixel-corners-sm bg-game-green-600 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="pixel-corners-sm-content w-full sm:w-auto px-4 sm:px-6 py-2 bg-game-green-600 hover:bg-game-green-700 disabled:bg-game-green-600/50 disabled:opacity-70 text-white font-bold transition text-sm sm:text-base whitespace-nowrap"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
              <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 shadow-game-sm hover:shadow-game transition-all w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="pixel-corners-sm-content w-full sm:w-auto px-4 sm:px-6 py-2 dark:bg-gray-700 bg-gray-300 dark:hover:bg-gray-600 hover:bg-gray-400 dark:text-white text-gray-900 font-bold transition text-sm sm:text-base whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>

          {/* Info Section */}
          <div className="dark:bg-gray-900/50 bg-gray-50 p-6 border-t-2 dark:border-gray-700 border-gray-300">
            <h3 className="text-sm font-bold dark:text-white text-gray-900 mb-3">Important Notes:</h3>
            <ul className="text-sm dark:text-gray-400 text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="dark:text-game-green-400 text-game-green-600 mt-1">•</span>
                <span>These settings control the URLs used for Discord OAuth callbacks and magic links</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-green-400 text-game-green-600 mt-1">•</span>
                <span>Make sure your DNS records point to this server before changing domains</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-green-400 text-game-green-600 mt-1">•</span>
                <span>Update your Discord OAuth redirect URLs to match the new web domain</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="dark:text-game-green-400 text-game-green-600 mt-1">•</span>
                <span>You may need to reload the page after saving for changes to take effect</span>
              </li>
            </ul>
          </div>
          </div>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 max-w-lg w-full mx-4">
            <div className="pixel-corners-sm-content dark:bg-gray-800/95 bg-white backdrop-blur-sm shadow-game">
            <div className="p-6 border-b-2 dark:border-gray-700 border-gray-300">
              <h2 className="text-lg font-pixel dark:text-white text-gray-900">⚠️ Change Discord Server</h2>
              <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">
                This action will completely wipe your SpinUp installation
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="pixel-corners-sm dark:border-game-red-900 border-game-red-400">
                <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-4">
                <p className="dark:text-game-red-500 text-game-red-900 text-sm font-bold mb-2">
                  This will permanently delete:
                </p>
                <ul className="dark:text-game-red-400 text-game-red-800 text-sm space-y-1 list-disc list-inside">
                  <li>All game servers and their data</li>
                  <li>All backups</li>
                  <li>All user memberships and permissions</li>
                  <li>All organization settings</li>
                </ul>
                </div>
              </div>

              {guildName && (
                <div className="pixel-corners-sm dark:border-game-primary-700 border-game-primary-400">
                  <div className="pixel-corners-sm-content dark:bg-game-primary-900/20 bg-game-primary-50 p-4">
                    <p className="text-sm dark:text-game-primary-300 text-game-primary-700">
                      <strong>Current Discord Server:</strong> {guildName}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-2">
                  To confirm, type: <span className="dark:text-white text-gray-900 font-mono">RESET-SYSTEM-COMPLETELY</span>
                </label>
                <div className="pixel-corners-sm dark:border-gray-600 border-gray-300">
                  <input
                    type="text"
                    value={resetConfirmName}
                    onChange={(e) => setResetConfirmName(e.target.value)}
                    placeholder="RESET-SYSTEM-COMPLETELY"
                    className="pixel-corners-sm-content w-full px-4 py-3 dark:bg-gray-700 bg-white dark:text-white text-gray-900 dark:placeholder-gray-400 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset font-mono"
                    autoFocus
                  />
                </div>
                <p className="dark:text-gray-500 text-gray-600 text-xs mt-1">
                  Type the confirmation text exactly as shown above (case-sensitive)
                </p>
              </div>

              {resetError && (
                <div className="pixel-corners-sm dark:border-game-red-900 border-game-red-400">
                  <div className="pixel-corners-sm-content dark:bg-game-red-900/20 bg-game-red-100 p-3">
                    <p className="dark:text-game-red-500 text-game-red-900 text-sm">{resetError}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t-2 dark:border-gray-700 border-gray-300 flex flex-col sm:flex-row gap-3">
              <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 shadow-game-sm hover:shadow-game transition-all flex-1">
                <button
                  onClick={() => {
                    setShowResetDialog(false)
                    setResetConfirmName('')
                    setResetError('')
                  }}
                  disabled={resetting}
                  className="pixel-corners-sm-content w-full px-4 sm:px-6 py-2 dark:bg-gray-700 bg-gray-300 dark:hover:bg-gray-600 hover:bg-gray-400 disabled:bg-gray-700/50 disabled:opacity-70 dark:text-white text-gray-900 font-bold transition text-sm sm:text-base whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
              <div className="pixel-corners-sm bg-game-red-700 shadow-game-sm hover:shadow-game transition-all flex-1">
                <button
                  onClick={handleResetSetup}
                  disabled={resetting || !resetConfirmName.trim()}
                  className="pixel-corners-sm-content w-full px-4 sm:px-6 py-2 bg-game-red-700 hover:bg-game-red-800 disabled:bg-game-red-700/50 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold transition text-sm sm:text-base"
                >
                  <span className="hidden sm:inline">{resetting ? 'Resetting...' : 'Delete Everything & Change Server'}</span>
                  <span className="sm:hidden">{resetting ? 'Resetting...' : 'Confirm Reset'}</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
