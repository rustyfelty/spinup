import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [webDomain, setWebDomain] = useState('')
  const [apiDomain, setApiDomain] = useState('')

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
      setWebDomain(data.webDomain || '')
      setApiDomain(data.apiDomain || '')
    } catch (err: any) {
      setError('Failed to load settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadGuildInfo = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/setup/org-info`)
      setGuildName(data.discordGuildName || '')
    } catch (err) {
      console.error('Failed to load guild info:', err)
    }
  }

  const handleResetSetup = async () => {
    if (!resetConfirmName.trim()) {
      setResetError('Please enter the server name')
      return
    }

    setResetting(true)
    setResetError('')

    try {
      await axios.post(`${API_URL}/api/setup/reset`, {
        confirmationName: resetConfirmName
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
      await api.patch('/api/settings', {
        webDomain,
        apiDomain
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-400 hover:text-white transition"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Discord Integration Section */}
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Discord Integration</h2>
            <p className="text-gray-400 text-sm mt-1">
              Manage Discord role permissions and settings
            </p>
          </div>

          <div className="p-6">
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300 mb-4">
                Configure which Discord roles have access to different features in SpinUp. The Server Owner always has full access to all features.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/discord-roles')}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Manage Role Permissions
                </button>
                <button
                  onClick={() => setShowResetDialog(true)}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                >
                  Change Discord Server
                </button>
              </div>
            </div>

            {/* Warning about changing server */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-yellow-300">
                <strong>Warning:</strong> Changing your Discord server will delete ALL data including servers, backups, and settings. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {/* Domain Configuration Section */}
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Domain Configuration</h2>
            <p className="text-gray-400 text-sm mt-1">
              Configure the public domain names for your SpinUp installation
            </p>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Web Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Web App Domain
              </label>
              <input
                type="url"
                value={webDomain}
                onChange={(e) => setWebDomain(e.target.value)}
                placeholder="https://daboyz.live"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-gray-400 text-xs mt-1">
                The public URL where your web app is accessible (e.g., https://daboyz.live)
              </p>
            </div>

            {/* API Domain */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Domain
              </label>
              <input
                type="url"
                value={apiDomain}
                onChange={(e) => setApiDomain(e.target.value)}
                placeholder="https://api.daboyz.live"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-gray-400 text-xs mt-1">
                The public URL where your API is accessible (e.g., https://api.daboyz.live)
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Info Section */}
          <div className="bg-gray-900/50 p-6 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">Important Notes:</h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>These settings control the URLs used for Discord OAuth callbacks and magic links</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Make sure your DNS records point to this server before changing domains</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Update your Discord OAuth redirect URLs to match the new web domain</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>You may need to reload the page after saving for changes to take effect</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">⚠️ Change Discord Server</h2>
              <p className="text-gray-400 text-sm mt-1">
                This action will completely wipe your SpinUp installation
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm font-semibold mb-2">
                  This will permanently delete:
                </p>
                <ul className="text-red-300 text-sm space-y-1 list-disc list-inside">
                  <li>All game servers and their data</li>
                  <li>All backups</li>
                  <li>All user memberships and permissions</li>
                  <li>All organization settings</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  To confirm, type your Discord server name: {guildName && <span className="text-white font-semibold">"{guildName}"</span>}
                </label>
                <input
                  type="text"
                  value={resetConfirmName}
                  onChange={(e) => setResetConfirmName(e.target.value)}
                  placeholder={guildName || "Enter server name exactly as shown"}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <p className="text-gray-500 text-xs mt-1">
                  Type the server name exactly as shown above to confirm deletion
                </p>
              </div>

              {resetError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{resetError}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowResetDialog(false)
                  setResetConfirmName('')
                  setResetError('')
                }}
                disabled={resetting}
                className="flex-1 px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSetup}
                disabled={resetting || !resetConfirmName.trim()}
                className="flex-1 px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {resetting ? 'Resetting...' : 'Delete Everything & Change Server'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
