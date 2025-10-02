import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [webDomain, setWebDomain] = useState('')
  const [apiDomain, setApiDomain] = useState('')

  useEffect(() => {
    loadSettings()
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
    </div>
  )
}
