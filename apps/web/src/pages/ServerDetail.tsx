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
import SystemHealthBar from '../components/SystemHealthBar'
import SystemHealthModal from '../components/SystemHealthModal'
import ThemeToggle from '../components/ThemeToggle'

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
  const [showHealthModal, setShowHealthModal] = useState(false)
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
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-game-green-500" />
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game">
            <div className="pixel-corners-content dark:bg-gray-800 bg-white p-8 text-center">
              <AlertCircle className="w-12 h-12 text-game-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 dark:text-white text-gray-900">Server not found</h2>
            <div className="pixel-corners-sm border-game-green-700 dark:border-game-green-600">
              <button
                onClick={() => navigate('/')}
                className="pixel-corners-sm-content mt-4 px-4 py-2 bg-game-green-600 dark:bg-game-green-500 text-white hover:bg-game-green-700 dark:hover:bg-game-green-600 shadow-game-sm font-bold"
              >
                Back to Dashboard
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const statusIcon = {
    RUNNING: <CheckCircle className="w-5 h-5 text-green-500" />,
    STOPPED: <XCircle className="w-5 h-5 text-gray-500" />,
    CREATING: <Loader2 className="w-5 h-5 text-game-purple-500 animate-spin" />,
    ERROR: <AlertCircle className="w-5 h-5 text-game-red-600" />,
    DELETING: <Loader2 className="w-5 h-5 text-game-red-600 animate-spin" />,
  }[server.status]

  const statusColor = {
    RUNNING: 'text-green-500 bg-green-50 border-green-200',
    STOPPED: 'text-gray-500 bg-gray-50 border-gray-200',
    CREATING: 'text-game-purple-500 bg-game-purple-50 border-game-purple-200',
    ERROR: 'text-game-red-600 bg-game-red-100 border-game-red-300',
    DELETING: 'text-game-red-600 bg-game-red-100 border-game-red-300',
  }[server.status]

  const isActionDisabled = server.status === 'CREATING' || server.status === 'DELETING'

  return (
    <div className="min-h-screen bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 from-gray-50 to-gray-100">
      {/* Header */}
      <header className="dark:bg-gray-800/95 bg-white dark:border-gray-700 border-b-2 border-gray-300 sticky top-0 z-40 shadow-game-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 gap-3">
            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                <button
                  onClick={() => navigate('/')}
                  className="pixel-corners-sm-content p-2 dark:hover:bg-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 dark:text-gray-300 text-gray-700" />
                </button>
              </div>
              <div className="hidden sm:block">
                <SystemHealthBar onClick={() => setShowHealthModal(true)} />
              </div>
            </div>

            {/* Action Buttons - Responsive Layout */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Steam Connect Link - Hide on mobile */}
              {GAMES.find(g => g.key === server.gameKey)?.steamGame && server.status === 'RUNNING' && (
                <div className="hidden lg:block pixel-corners-sm border-game-purple-700 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                  <a
                    href={`steam://connect/${getServerIP()}:${(server.ports as any[])?.[0]?.host}`}
                    className="pixel-corners-sm-content px-4 py-2 bg-game-purple-600 text-white hover:bg-game-purple-700 transition-colors flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Connect via Steam</span>
                  </a>
                </div>
              )}

              {/* Primary Actions */}
              <div className="pixel-corners-sm border-game-purple-600 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={server.status === 'RUNNING' || isActionDisabled || startMutation.isPending}
                  className="pixel-corners-sm-content px-3 sm:px-4 py-2 bg-game-purple-500 text-white hover:bg-game-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 font-bold text-sm"
                >
                {startMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{startMutation.isPending ? 'Starting...' : 'Start'}</span>
                </button>
              </div>
              <div className="pixel-corners-sm border-game-purple-600 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                <button
                  onClick={() => stopMutation.mutate()}
                  disabled={server.status === 'STOPPED' || isActionDisabled || stopMutation.isPending}
                  className="pixel-corners-sm-content px-3 sm:px-4 py-2 bg-game-purple-500 text-white hover:bg-game-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 text-sm"
                >
                {stopMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{stopMutation.isPending ? 'Stopping...' : 'Stop'}</span>
                </button>
              </div>
              <div className="pixel-corners-sm border-game-purple-600 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                <button
                  onClick={() => restartMutation.mutate()}
                  disabled={server.status !== 'RUNNING' || isActionDisabled || restartMutation.isPending}
                  className="pixel-corners-sm-content px-3 sm:px-4 py-2 bg-game-purple-500 text-white hover:bg-game-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2 text-sm"
                >
                {restartMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{restartMutation.isPending ? 'Restarting...' : 'Restart'}</span>
                </button>
              </div>
              <div className="hidden sm:block pixel-corners-sm border-gray-600 transition-all duration-150 hover:shadow-game active:translate-y-1 active:shadow-none">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isActionDisabled}
                  className="pixel-corners-sm-content px-4 py-2 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
                >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
        </div>
      </header>

      {/* Server Info Sub-Header */}
      <div className="dark:bg-gray-800 bg-white dark:border-b-2 border-b-2 dark:border-gray-700 border-gray-300 shadow-game-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Server Name and Game */}
            <div>
              <h1 className="text-2xl md:text-3xl font-pixel dark:text-white text-gray-900 mb-2">{server.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="pixel-corners-xs dark:border-gray-600 border-gray-300">
                  <span className="pixel-corners-xs-content inline-flex items-center px-3 py-1 text-sm font-bold dark:bg-gray-700 bg-gray-100 dark:text-white text-gray-900">
                    {server.gameKey}
                  </span>
                </div>
                <div className={`pixel-corners-xs border-[3px] ${statusColor.includes('green') ? 'border-green-200' : statusColor.includes('red') ? 'border-game-red-300' : statusColor.includes('blue') ? 'border-game-purple-200' : 'border-gray-200'}`}>
                  <div className={`pixel-corners-xs-content inline-flex items-center space-x-2 px-3 py-1 text-sm font-bold ${statusColor}`}>
                    {statusIcon}
                    <span>{server.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Server Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {/* Memory */}
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="w-4 h-4 dark:text-game-green-400 text-game-green-600" />
                    <span className="text-xs font-bold dark:text-gray-400 text-gray-600">MEMORY</span>
                  </div>
                  <p className="text-lg font-bold dark:text-white text-gray-900">
                    {(server.memoryCap / 1024).toFixed(1)}GB
                  </p>
                </div>
              </div>

              {/* CPU */}
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 dark:text-game-green-400 text-game-green-600" />
                    <span className="text-xs font-bold dark:text-gray-400 text-gray-600">CPU</span>
                  </div>
                  <p className="text-lg font-bold dark:text-white text-gray-900">
                    {(server.cpuShares / 1024).toFixed(1)} cores
                  </p>
                </div>
              </div>

              {/* Connection */}
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 dark:text-game-green-400 text-game-green-600" />
                    <span className="text-xs font-bold dark:text-gray-400 text-gray-600">PORT</span>
                  </div>
                  <p className="text-lg font-bold dark:text-white text-gray-900 font-mono">
                    {(server.ports as any[])?.[0]?.host || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Created Date */}
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 dark:text-game-green-400 text-game-green-600" />
                    <span className="text-xs font-bold dark:text-gray-400 text-gray-600">CREATED</span>
                  </div>
                  <p className="text-lg font-bold dark:text-white text-gray-900">
                    {new Date(server.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Creating Status Banner */}
        {server.status === 'CREATING' && (
          <div className="pixel-corners dark:bg-game-purple-800 bg-game-purple-300 mb-6 shadow-game-light">
            <div className="pixel-corners-content dark:bg-game-purple-900/20 bg-game-purple-50 p-6">
            <div className="flex items-start space-x-4">
              <Loader2 className="w-6 h-6 text-game-purple-500 animate-spin flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold dark:text-game-purple-300 text-game-purple-900 mb-2">Setting Up Your Server</h3>
                <p className="dark:text-game-purple-400 text-game-purple-700 mb-3">
                  Your server is being created. This may take a few minutes as we pull the Docker image and configure your container.
                </p>
                <div className="pixel-corners-sm dark:border-game-purple-800 border-game-purple-300">
                  <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white p-3">
                  <p className="text-sm font-medium dark:text-game-purple-300 text-game-purple-900 mb-2">Setup Progress:</p>
                  <ul className="text-sm dark:text-game-purple-400 text-game-purple-700 space-y-1 list-disc list-inside">
                    <li>Creating Docker container</li>
                    <li>Pulling {server.gameKey} image</li>
                    <li>Configuring volumes and ports</li>
                    <li>Starting server initialization</li>
                  </ul>
                  </div>
                </div>
                <p className="text-xs text-game-purple-600 mt-3">
                  Check the Console tab below to see real-time progress logs
                </p>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="pixel-corners dark:bg-gray-700 bg-gray-300 shadow-game-light">
          <div className="pixel-corners-content dark:bg-gray-800 bg-white">
            <div className="border-b-2 dark:border-gray-700 border-gray-300">
            {/* Desktop Tabs */}
            <nav className="hidden md:flex space-x-8 px-6" aria-label="Tabs">
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
                    py-4 px-1 border-b-2 font-bold text-sm flex items-center space-x-2
                    ${activeTab === tab.id
                      ? 'border-game-green-500 text-game-green-600 dark:text-game-green-400'
                      : 'border-transparent dark:text-gray-400 text-gray-500 dark:hover:text-gray-200 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile Tab Grid */}
            <div className="md:hidden grid grid-cols-5 gap-0">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'config', label: 'Config', icon: Settings },
                { id: 'console', label: 'Console', icon: Terminal },
                { id: 'files', label: 'Files', icon: FolderOpen },
                { id: 'settings', label: 'Settings', icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    py-3 px-2 border-b-2 font-bold text-xs flex flex-col items-center justify-center gap-1 min-h-[64px]
                    ${activeTab === tab.id
                      ? 'border-game-green-500 text-game-green-600 dark:text-game-green-400 dark:bg-gray-700/50 bg-gray-50'
                      : 'border-transparent dark:text-gray-400 text-gray-500'}
                  `}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="leading-tight text-center">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-pixel mb-4 dark:text-white text-gray-900">Server Information</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm dark:text-gray-400 text-gray-500 font-bold">Server ID</dt>
                      <dd className="mt-1 text-sm font-mono dark:text-white text-gray-900">{server.id}</dd>
                    </div>
                    <div>
                      <dt className="text-sm dark:text-gray-400 text-gray-500 font-bold">Container ID</dt>
                      <dd className="mt-1 text-sm font-mono dark:text-white text-gray-900">{server.containerId || 'Not created'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm dark:text-gray-400 text-gray-500 font-bold">Organization</dt>
                      <dd className="mt-1 text-sm dark:text-white text-gray-900">{server.orgId}</dd>
                    </div>
                    <div>
                      <dt className="text-sm dark:text-gray-400 text-gray-500 font-bold">Created By</dt>
                      <dd className="mt-1 text-sm dark:text-white text-gray-900">{server.createdBy}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-base font-pixel mb-4 dark:text-white text-gray-900">Connection Details</h3>
                  <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                    <div className="pixel-corners-sm-content dark:bg-gray-900/50 bg-gray-50 p-4">
                    <p className="text-sm dark:text-gray-400 text-gray-600 mb-2 font-bold">Connect to your server using:</p>
                    <div className="flex items-center space-x-2 mb-3">
                      <code className="flex-1 px-3 py-2 dark:bg-gray-800 bg-white border-2 dark:border-gray-700 border-gray-300 rounded font-mono text-sm dark:text-white text-gray-900">
                        {getServerIP()}:{(server.ports as any[])?.[0]?.host || 'N/A'}
                      </code>
                      <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                        <button
                          onClick={() => navigator.clipboard.writeText(`${getServerIP()}:${(server.ports as any[])?.[0]?.host || ''}`)}
                          className="pixel-corners-sm-content p-2 dark:hover:bg-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {GAMES.find(g => g.key === server.gameKey)?.steamGame && (
                      <div className="pixel-corners-sm border-game-purple-600">
                        <a
                          href={`steam://connect/${getServerIP()}:${(server.ports as any[])?.[0]?.host}`}
                          className="pixel-corners-sm-content inline-flex items-center space-x-2 px-4 py-2 bg-game-purple-500 text-white hover:bg-game-purple-600 transition-colors text-sm shadow-game-sm font-bold"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Connect via Steam</span>
                        </a>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div>
                <h3 className="text-base font-pixel mb-4 dark:text-white text-gray-900">File Manager</h3>
                <p className="dark:text-gray-400 text-gray-600 mb-6">
                  Browse, edit, and manage files in your server's data directory.
                </p>
                {server.status === 'RUNNING' || server.status === 'STOPPED' ? (
                  <FileManager serverId={server.id} gameKey={server.gameKey} />
                ) : (
                  <div className="pixel-corners-sm dark:border-yellow-800 border-yellow-300">
                    <div className="pixel-corners-sm-content dark:bg-yellow-900/20 bg-yellow-50 p-4">
                    <AlertCircle className="w-5 h-5 text-yellow-600 inline mr-2" />
                    <span className="dark:text-yellow-400 text-yellow-700">
                      Server must be in RUNNING or STOPPED state to access files.
                    </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div>
                {server.gameKey === 'minecraft-java' ? (
                  <div>
                    <h3 className="text-base font-pixel mb-4 dark:text-white text-gray-900">Minecraft Configuration</h3>
                    {configLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-game-green-500" />
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
                    <Settings className="w-12 h-12 dark:text-gray-500 text-gray-400 mx-auto mb-4" />
                    <p className="dark:text-gray-400 text-gray-500">Configuration editor not available for this game type</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'console' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-pixel dark:text-white text-gray-900">Server Console</h3>
                  <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['logs', id] })}
                      className="pixel-corners-sm-content flex items-center space-x-2 px-3 py-1 text-sm dark:hover:bg-gray-700 hover:bg-gray-50 dark:text-white text-gray-900 font-bold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
                <div className="pixel-corners-sm border-gray-700">
                  <div className="pixel-corners-sm-content bg-gray-900 p-4 h-[32rem] overflow-y-auto font-mono text-sm shadow-game">
                  {server.status === 'CREATING' && (
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <p className="text-game-purple-400">🔄 Server is being created...</p>
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
                </div>
                <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                  <div className="pixel-corners-sm-content mt-4 p-3 dark:bg-gray-800 bg-gray-50">
                  <p className="text-xs dark:text-gray-400 text-gray-600">
                    <strong>Tip:</strong> Console logs auto-refresh every 2 seconds.
                    {server.status === 'CREATING' && ' Your server is currently being set up - logs will appear as the container initializes.'}
                  </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <h3 className="text-base font-pixel mb-4 dark:text-white text-gray-900">Danger Zone</h3>
                <div className="pixel-corners-sm dark:border-game-red-900 border-game-red-400">
                  <div className="pixel-corners-sm-content p-4 dark:bg-game-red-900/20 bg-game-red-100">
                  <p className="text-sm dark:text-game-red-500 text-game-red-900 mb-4">
                    Deleting a server will permanently remove all data and cannot be undone.
                  </p>
                  <div className="pixel-corners-sm border-game-red-800">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="pixel-corners-sm-content px-4 py-2 bg-game-red-700 text-white hover:bg-game-red-800 shadow-game-sm font-bold"
                    >
                      Delete Server
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="pixel-corners dark:bg-gray-700 bg-gray-300 max-w-md w-full mx-4 shadow-game">
            <div className="pixel-corners-content dark:bg-gray-800 bg-white p-6">
              <h3 className="text-lg font-bold mb-4 dark:text-white text-gray-900">Delete Server</h3>
            <p className="dark:text-gray-400 text-gray-600 mb-6">
              Are you sure you want to delete "{server.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <div className="pixel-corners-sm dark:border-gray-700 border-gray-300">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="pixel-corners-sm-content px-4 py-2 dark:hover:bg-gray-700 hover:bg-gray-50 dark:text-white text-gray-900 font-bold"
                >
                  Cancel
                </button>
              </div>
              <div className="pixel-corners-sm border-game-red-800">
                <button
                  onClick={() => deleteMutation.mutate()}
                  className="pixel-corners-sm-content px-4 py-2 bg-game-red-700 text-white hover:bg-game-red-800 shadow-game-sm font-bold"
                >
                  Delete
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health Modal */}
      {showHealthModal && (
        <SystemHealthModal onClose={() => setShowHealthModal(false)} />
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
          <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-1">World Name</label>
          <input
            type="text"
            value={values.level_name || ''}
            onChange={(e) => handleChange('level_name', e.target.value)}
            className="w-full px-3 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-1">Difficulty</label>
          <select
            value={values.difficulty || 'normal'}
            onChange={(e) => handleChange('difficulty', e.target.value)}
            className="w-full px-3 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="peaceful">Peaceful</option>
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-1">Game Mode</label>
          <select
            value={values.gamemode || 'survival'}
            onChange={(e) => handleChange('gamemode', e.target.value)}
            className="w-full px-3 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="survival">Survival</option>
            <option value="creative">Creative</option>
            <option value="adventure">Adventure</option>
            <option value="spectator">Spectator</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-1">Max Players</label>
          <input
            type="number"
            value={values.max_players || 20}
            onChange={(e) => handleChange('max_players', parseInt(e.target.value))}
            className="w-full px-3 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold dark:text-gray-300 text-gray-700 mb-1">MOTD</label>
          <input
            type="text"
            value={values.motd || ''}
            onChange={(e) => handleChange('motd', e.target.value)}
            className="w-full px-3 py-2 border-2 dark:border-gray-700 border-gray-300 rounded focus:ring-2 focus:ring-game-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t-2 dark:border-gray-700 border-gray-300">
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center dark:text-gray-300 text-gray-700 font-bold">
            <input
              type="checkbox"
              checked={values.pvp === 'true'}
              onChange={(e) => handleChange('pvp', e.target.checked ? 'true' : 'false')}
              className="mr-2 w-4 h-4"
            />
            PvP Enabled
          </label>
          <label className="flex items-center dark:text-gray-300 text-gray-700 font-bold">
            <input
              type="checkbox"
              checked={values.online_mode === 'true'}
              onChange={(e) => handleChange('online_mode', e.target.checked ? 'true' : 'false')}
              className="mr-2 w-4 h-4"
            />
            Online Mode
          </label>
          <label className="flex items-center dark:text-gray-300 text-gray-700 font-bold">
            <input
              type="checkbox"
              checked={values.white_list === 'true'}
              onChange={(e) => handleChange('white_list', e.target.checked ? 'true' : 'false')}
              className="mr-2 w-4 h-4"
            />
            Whitelist
          </label>
        </div>
        <div className="pixel-corners-sm border-game-green-700 dark:border-game-green-600">
          <button
            type="submit"
            disabled={isSaving}
            className="pixel-corners-sm-content px-4 py-2 bg-game-green-600 dark:bg-game-green-500 text-white hover:bg-game-green-700 dark:hover:bg-game-green-600 disabled:opacity-50 flex items-center space-x-2 shadow-game-sm font-bold"
          >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </form>
  )
}