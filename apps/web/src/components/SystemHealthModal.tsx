import { useQuery } from '@tanstack/react-query';
import {
  XCircle,
  CheckCircle,
  AlertTriangle,
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  Package,
  Server,
  RefreshCw,
} from 'lucide-react';
import { systemApi } from '../lib/api';

interface SystemHealthModalProps {
  onClose: () => void;
}

export default function SystemHealthModal({ onClose }: SystemHealthModalProps) {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: systemApi.getHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: resources } = useQuery({
    queryKey: ['system', 'resources'],
    queryFn: systemApi.getResources,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getStatusIcon = (status: 'healthy' | 'unhealthy' | 'unknown') => {
    if (status === 'healthy') return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === 'unhealthy') return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return 'text-green-600 bg-green-50 border-green-200';
    if (status === 'degraded') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (status === 'unhealthy') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
              <p className="text-sm text-gray-600 mt-1">
                Real-time monitoring of system components
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => refetch()}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading system health...</p>
            </div>
          ) : health ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-6 rounded-2xl border-2 ${getStatusColor(health.status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {health.status === 'healthy' && <CheckCircle className="w-8 h-8" />}
                    {health.status === 'degraded' && <AlertTriangle className="w-8 h-8" />}
                    {health.status === 'unhealthy' && <XCircle className="w-8 h-8" />}
                    <div>
                      <h3 className="text-lg font-semibold capitalize">{health.status}</h3>
                      <p className="text-sm opacity-75">
                        Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Checks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Database */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Database className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Database</span>
                    </div>
                    {getStatusIcon(health.checks.database.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Latency: {health.checks.database.latency}ms</p>
                    {health.checks.database.error && (
                      <p className="text-red-600">{health.checks.database.error}</p>
                    )}
                  </div>
                </div>

                {/* Docker */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Docker</span>
                    </div>
                    {getStatusIcon(health.checks.docker.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Containers: {health.checks.docker.containers}</p>
                    {health.checks.docker.error && (
                      <p className="text-red-600">{health.checks.docker.error}</p>
                    )}
                  </div>
                </div>

                {/* Memory */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <MemoryStick className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Memory</span>
                    </div>
                    {getStatusIcon(health.checks.memory.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Usage: {health.checks.memory.usagePercent}%</p>
                    <p>Available: {Math.floor(health.checks.memory.availableMB / 1024)}GB</p>
                  </div>
                </div>

                {/* Disk */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <HardDrive className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Disk</span>
                    </div>
                    {getStatusIcon(health.checks.disk.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Usage: {health.checks.disk.usagePercent}%</p>
                    {health.checks.disk.error && (
                      <p className="text-red-600">{health.checks.disk.error}</p>
                    )}
                  </div>
                </div>

                {/* Redis */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Server className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">Redis</span>
                    </div>
                    {getStatusIcon(health.checks.redis.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {health.checks.redis.error ? (
                      <p className="text-red-600">{health.checks.redis.error}</p>
                    ) : (
                      <p>Connected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Resource Usage */}
              {resources && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h3>
                  <div className="space-y-4">
                    {/* Memory Bar */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <MemoryStick className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">Memory</span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.floor(resources.memory.used / 1024)}GB / {Math.floor(resources.memory.total / 1024)}GB
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(resources.memory.used / resources.memory.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Allocated to servers: {Math.floor(resources.memory.allocated / 1024)}GB
                      </p>
                    </div>

                    {/* CPU Bar */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Cpu className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">CPU</span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {resources.cpu.cores} cores
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Load Average: {resources.cpu.loadAverage.join(', ')}</p>
                        <p>Allocated: {(resources.cpu.allocatedShares / 1024).toFixed(1)} cores</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <p className="text-gray-600">Failed to load system health</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
