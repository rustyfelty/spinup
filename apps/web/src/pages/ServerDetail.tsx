import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Play, Square, RotateCw, Trash2, Settings, Terminal,
  HardDrive, Activity, Clock, Globe, Shield, AlertCircle, CheckCircle,
  XCircle, Loader2, Copy, ExternalLink, Save, RefreshCw, FolderOpen
} from 'lucide-react'
import { serversApi, configApi } from '../lib/api'
import type { Server } from '@spinup/shared'
import { GAMES } from '@spinup/shared'
import FileManager from '../components/FileManager'

// Get server IP from environment
const getServerIP = () => {
  const webOrigin = import.meta.env.VITE_WEB_ORIGIN || window.location.origin
  try {
    const url = new URL(webOrigin)
    return url.hostname
  } catch {
    return 'localhost'
  }
}

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'console' | 'files' | 'settings'>('console')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])

  // Fetch server details
  const { data: server, isLoading, error } = useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.get(id!),
    enabled: !!id,
    refetchInterval: 5000, // Poll for updates every 5 seconds
  })

  // Fetch console logs
  const { data: logs } = useQuery({
    queryKey: ['logs', id],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/servers/${id}/logs`, {
          credentials: 'include'
        })
        if (!response.ok) return []
        return await response.json()
      } catch {
        return []
      }
    },
    enabled: !!id && activeTab === 'console',
    refetchInterval: 2000, // Poll for logs every 2 seconds
  })

  // Update console logs when new logs arrive
  React.useEffect(() => {
    if (logs && Array.isArray(logs)) {
      setConsoleLogs(logs)
    }
  }, [logs])

  // Fetch config if Minecraft
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config', id],
    queryFn: () => configApi.get(id!),
    enabled: !!id && server?.gameKey === 'minecraft-java' && activeTab === 'config',
  })

  // Server actions
  const startMutation = useMutation({
    mutationFn: () => serversApi.start(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] })
    },
    onError: (error: any) => {
      alert(`Failed to start server: ${error.response?.data?.message || error.message}`)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => serversApi.stop(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] })
    },
    onError: (error: any) => {
      alert(`Failed to stop server: ${error.response?.data?.message || error.message}`)
    },
  })

  const restartMutation = useMutation({
    mutationFn: async () => {
      await serversApi.stop(id!)
      await new Promise(resolve => setTimeout(resolve, 2000))
      await serversApi.start(id!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] })
    },
    onError: (error: any) => {
      alert(`Failed to restart server: ${error.response?.data?.message || error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => serversApi.delete(id!),
    onSuccess: () => {
      navigate('/')
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: any) => configApi.update(id!, newConfig),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['config', id] })
      if (data.needsRestart) {
        alert('Configuration saved. Restart the server for changes to take effect.')
      }
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Server not found</h2>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const statusIcon = {
    RUNNING: <CheckCircle className="w-5 h-5 text-green-500" />,
    STOPPED: <XCircle className="w-5 h-5 text-gray-500" />,
    CREATING: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
    ERROR: <AlertCircle className="w-5 h-5 text-red-500" />,
    DELETING: <Loader2 className="w-5 h-5 text-red-500 animate-spin" />,
  }[server.status]

  const statusColor = {
    RUNNING: 'text-green-500 bg-green-50 border-green-200',
    STOPPED: 'text-gray-500 bg-gray-50 border-gray-200',
    CREATING: 'text-blue-500 bg-blue-50 border-blue-200',
    ERROR: 'text-red-500 bg-red-50 border-red-200',
    DELETING: 'text-red-500 bg-red-50 border-red-200',
  }[server.status]

  const isActionDisabled = server.status === 'CREATING' || server.status === 'DELETING'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">{server.name}</h1>
                <p className="text-sm text-gray-500">{server.gameKey}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Steam Connect Link */}
              {GAMES.find(g => g.key === server.gameKey)?.steamGame && server.status === 'RUNNING' && (
                <a
                  href={`steam://connect/${getServerIP()}:${(server.ports as any[])?.[0]?.host}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect via Steam</span>
                </a>
              )}

              <button
                onClick={() => startMutation.mutate()}
                disabled={server.status === 'RUNNING' || isActionDisabled || startMutation.isPending}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {startMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{startMutation.isPending ? 'Starting...' : 'Start'}</span>
              </button>
              <button
                onClick={() => stopMutation.mutate()}
                disabled={server.status === 'STOPPED' || isActionDisabled || stopMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {stopMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>{stopMutation.isPending ? 'Stopping...' : 'Stop'}</span>
              </button>
              <button
                onClick={() => restartMutation.mutate()}
                disabled={server.status !== 'RUNNING' || isActionDisabled || restartMutation.isPending}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {restartMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                <span>{restartMutation.isPending ? 'Restarting...' : 'Restart'}</span>
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={isActionDisabled}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Creating Status Banner */}
        {server.status === 'CREATING' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start space-x-4">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Setting Up Your Server</h3>
                <p className="text-blue-700 mb-3">
                  Your server is being created. This may take a few minutes as we pull the Docker image and configure your container.
                </p>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-2">Setup Progress:</p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Creating Docker container</li>
                    <li>Pulling {server.gameKey} image</li>
                    <li>Configuring volumes and ports</li>
                    <li>Starting server initialization</li>
                  </ul>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  Check the Console tab below to see real-time progress logs
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border ${statusColor}`}>
                {statusIcon}
                <span className="font-medium">{server.status}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Game</p>
              <p className="font-medium">{server.gameKey}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Ports</p>
              <div className="flex flex-wrap gap-2">
                {(server.ports as any[] || []).map((port, index) => (
                  <span key={index} className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {port.host}:{port.container}/{port.proto}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Created</p>
              <p className="font-medium">
                {new Date(server.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'config', label: 'Configuration', icon: Settings },
                { id: 'console', label: 'Console', icon: Terminal },
                { id: 'files', label: 'Files', icon: FolderOpen },
                { id: 'settings', label: 'Settings', icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                    ${activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Server Information</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-gray-500">Server ID</dt>
                      <dd className="mt-1 text-sm font-mono">{server.id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Container ID</dt>
                      <dd className="mt-1 text-sm font-mono">{server.containerId || 'Not created'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Organization</dt>
                      <dd className="mt-1 text-sm">{server.orgId}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Created By</dt>
                      <dd className="mt-1 text-sm">{server.createdBy}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Connection Details</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Connect to your server using:</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg font-mono text-sm">
                        {getServerIP()}:{(server.ports as any[])?.[0]?.host || 'N/A'}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${getServerIP()}:${(server.ports as any[])?.[0]?.host || ''}`)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {GAMES.find(g => g.key === server.gameKey)?.steamGame && (
                      <a
                        href={`steam://connect/${getServerIP()}:${(server.ports as any[])?.[0]?.host}`}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Connect via Steam</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div>
                <h3 className="text-lg font-medium mb-4">File Manager</h3>
                <p className="text-gray-600 mb-6">
                  Browse, edit, and manage files in your server's data directory.
                </p>
                {server.status === 'RUNNING' || server.status === 'STOPPED' ? (
                  <FileManager serverId={server.id} gameKey={server.gameKey} />
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <AlertCircle className="w-5 h-5 text-yellow-600 inline mr-2" />
                    <span className="text-yellow-700">
                      Server must be in RUNNING or STOPPED state to access files.
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div>
                {server.gameKey === 'minecraft-java' ? (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Minecraft Configuration</h3>
                    {configLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      </div>
                    ) : (
                      <ConfigEditor
                        config={config}
                        onSave={(newConfig) => updateConfigMutation.mutate(newConfig)}
                        isSaving={updateConfigMutation.isPending}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Configuration editor not available for this game type</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'console' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Server Console</h3>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['logs', id] })}
                    className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 h-[32rem] overflow-y-auto font-mono text-sm">
                  {server.status === 'CREATING' && (
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <p className="text-blue-400">🔄 Server is being created...</p>
                      <p className="text-gray-500 mt-1">Pulling Docker image and initializing container...</p>
                    </div>
                  )}

                  {consoleLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500">
                        {server.status === 'CREATING'
                          ? 'Waiting for logs... Container is starting up.'
                          : server.status === 'STOPPED'
                          ? 'Server is stopped. Start the server to see console output.'
                          : 'No logs available yet. Logs will appear once the server starts.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {consoleLogs.map((log, index) => (
                        <div key={index} className="text-gray-300 hover:bg-gray-800 px-2 py-0.5 rounded">
                          <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                      {server.status === 'CREATING' && (
                        <div className="text-yellow-400 animate-pulse mt-2">
                          <span className="mr-2">⚙️</span>
                          Initializing server components...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600">
                    <strong>Tip:</strong> Console logs auto-refresh every 2 seconds.
                    {server.status === 'CREATING' && ' Your server is currently being set up - logs will appear as the container initializes.'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-medium mb-4">Danger Zone</h3>
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <p className="text-sm text-red-800 mb-4">
                    Deleting a server will permanently remove all data and cannot be undone.
                  </p>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete Server
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Server</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{server.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Config Editor Component
function ConfigEditor({ config, onSave, isSaving }: any) {
  const [values, setValues] = useState(config || {})

  const handleChange = (key: string, value: any) => {
    setValues({ ...values, [key]: value })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(values) }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">World Name</label>
          <input
            type="text"
            value={values.level_name || ''}
            onChange={(e) => handleChange('level_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
          <select
            value={values.difficulty || 'normal'}
            onChange={(e) => handleChange('difficulty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="peaceful">Peaceful</option>
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Game Mode</label>
          <select
            value={values.gamemode || 'survival'}
            onChange={(e) => handleChange('gamemode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="survival">Survival</option>
            <option value="creative">Creative</option>
            <option value="adventure">Adventure</option>
            <option value="spectator">Spectator</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
          <input
            type="number"
            value={values.max_players || 20}
            onChange={(e) => handleChange('max_players', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">MOTD</label>
          <input
            type="text"
            value={values.motd || ''}
            onChange={(e) => handleChange('motd', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={values.pvp === 'true'}
              onChange={(e) => handleChange('pvp', e.target.checked ? 'true' : 'false')}
              className="mr-2"
            />
            PvP Enabled
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={values.online_mode === 'true'}
              onChange={(e) => handleChange('online_mode', e.target.checked ? 'true' : 'false')}
              className="mr-2"
            />
            Online Mode
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={values.white_list === 'true'}
              onChange={(e) => handleChange('white_list', e.target.checked ? 'true' : 'false')}
              className="mr-2"
            />
            Whitelist
          </label>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  )
}