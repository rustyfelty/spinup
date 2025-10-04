import { useQuery } from '@tanstack/react-query';
import { Heart, Zap, Activity } from 'lucide-react';
import { systemApi } from '../lib/api';
import { useState } from 'react';

interface SystemHealthBarProps {
  onClick?: () => void;
}

export default function SystemHealthBar({ onClick }: SystemHealthBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { data: health } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: systemApi.getHealth,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: resources } = useQuery({
    queryKey: ['system', 'resources'],
    queryFn: systemApi.getResources,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (!health || !resources) {
    return null;
  }

  const memoryPercent = (resources.memory.used / resources.memory.total) * 100;
  const memoryAllocatedPercent = (resources.memory.allocated / resources.memory.total) * 100;
  const cpuLoadPercent = Math.min((resources.cpu.loadAverage[0] / resources.cpu.cores) * 100, 100);
  const cpuAllocatedPercent = (resources.cpu.allocatedShares / resources.cpu.totalShares) * 100;

  // Calculate number of hearts (out of 10)
  const memoryHearts = Math.ceil((memoryPercent / 100) * 10);
  const cpuHearts = Math.ceil((cpuLoadPercent / 100) * 10);

  const getHeartColor = (index: number, filledCount: number, percent: number) => {
    if (index < filledCount) {
      if (percent > 90) return 'text-red-500';
      if (percent > 70) return 'text-yellow-500';
      return 'text-game-purple-500';
    }
    return 'dark:text-gray-600 text-gray-300';
  };

  // Calculate overall health status
  const maxPercent = Math.max(memoryPercent, cpuLoadPercent);
  const healthColor = maxPercent > 90 ? 'text-red-500' : maxPercent > 70 ? 'text-yellow-500' : 'text-game-purple-500';

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 transition-all duration-150 hover:shadow-game-sm active:translate-y-1 active:shadow-none"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title="Click for details"
      >
        <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white dark:hover:bg-gray-700 hover:bg-gray-50 flex items-center p-2 transition-colors">
        {/* Mobile: Single icon */}
        <div className="md:hidden">
          <Activity className={`w-5 h-5 ${healthColor}`} />
        </div>

        {/* Desktop: Full health bars */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Memory Hearts */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-bold dark:text-gray-400 text-gray-600 mr-1">RAM</span>
            <div className="flex space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <Heart
                  key={`mem-${i}`}
                  className={`w-3 h-3 transition-colors duration-300 ${getHeartColor(i, Math.ceil(memoryHearts / 2), memoryPercent)}`}
                  fill={i < Math.ceil(memoryHearts / 2) ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              ))}
            </div>
          </div>

          {/* CPU Lightning */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-bold dark:text-gray-400 text-gray-600 mr-1">CPU</span>
            <div className="flex space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <Zap
                  key={`cpu-${i}`}
                  className={`w-3 h-3 transition-colors duration-300 ${getHeartColor(i, Math.ceil(cpuHearts / 2), cpuLoadPercent)}`}
                  fill={i < Math.ceil(cpuHearts / 2) ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              ))}
            </div>
          </div>
        </div>
        </div>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 mt-2 w-72 z-50">
          <div
            className="pixel-corners-sm bg-gray-700 shadow-2xl"
            style={{
              boxShadow: '0 4px 0 0 rgba(0,0,0,0.5), inset 0 2px 0 0 rgba(255,255,255,0.1)'
            }}
          >
            <div className="pixel-corners-sm-content bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
              <div className="space-y-4">
                {/* Memory Details */}
                <div className="pixel-corners-sm bg-gray-700">
                  <div className="pixel-corners-sm-content bg-gray-800/50 p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Heart className={`w-5 h-5 ${memoryPercent > 90 ? 'text-red-500' : memoryPercent > 70 ? 'text-yellow-500' : 'text-game-purple-500'}`} fill="currentColor" />
                <span className="text-sm font-bold tracking-wide">MEMORY</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Used:</span>
                  <span className="text-white font-bold">{Math.floor(resources.memory.used / 1024)}GB / {Math.floor(resources.memory.total / 1024)}GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Allocated:</span>
                  <span className="text-yellow-400 font-bold">{Math.floor(resources.memory.allocated / 1024)}GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Available:</span>
                  <span className="text-green-400 font-bold">{Math.floor(resources.memory.available / 1024)}GB</span>
                </div>
                {/* Progress Bar */}
                <div className="mt-2 relative h-4 bg-gray-900 rounded border-2 border-gray-600 overflow-hidden">
                  {/* Allocated (background) */}
                  <div
                    className="absolute inset-0 bg-yellow-900/40 transition-all duration-300"
                    style={{ width: `${memoryAllocatedPercent}%` }}
                  />
                  {/* Used (foreground) */}
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      memoryPercent > 90 ? 'bg-gradient-to-r from-red-600 to-red-500' :
                      memoryPercent > 70 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                      'bg-gradient-to-r from-game-purple-600 to-game-purple-500'
                    }`}
                    style={{ width: `${memoryPercent}%` }}
                  />
                  {/* Percentage Text */}
                  <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold drop-shadow-lg">
                    {memoryPercent.toFixed(0)}%
                  </div>
                </div>
              </div>
                  </div>
                </div>

                {/* CPU Details */}
                <div className="pixel-corners-sm bg-gray-700">
                  <div className="pixel-corners-sm-content bg-gray-800/50 p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className={`w-5 h-5 ${cpuLoadPercent > 90 ? 'text-red-500' : cpuLoadPercent > 70 ? 'text-yellow-500' : 'text-game-purple-500'}`} fill="currentColor" />
                <span className="text-sm font-bold tracking-wide">CPU POWER</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cores:</span>
                  <span className="text-white font-bold">{resources.cpu.cores}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Load:</span>
                  <span className="text-white font-bold">{resources.cpu.loadAverage[0].toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Allocated:</span>
                  <span className="text-yellow-400 font-bold">{(resources.cpu.allocatedShares / 1024).toFixed(1)} cores</span>
                </div>
                {/* Progress Bar */}
                <div className="mt-2 relative h-4 bg-gray-900 rounded border-2 border-gray-600 overflow-hidden">
                  {/* Allocated (background) */}
                  <div
                    className="absolute inset-0 bg-yellow-900/40 transition-all duration-300"
                    style={{ width: `${cpuAllocatedPercent}%` }}
                  />
                  {/* Used (foreground) */}
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      cpuLoadPercent > 90 ? 'bg-gradient-to-r from-red-600 to-red-500' :
                      cpuLoadPercent > 70 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                      'bg-gradient-to-r from-game-purple-600 to-game-purple-500'
                    }`}
                    style={{ width: `${cpuLoadPercent}%` }}
                  />
                  {/* Percentage Text */}
                  <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold drop-shadow-lg">
                    {cpuLoadPercent.toFixed(0)}%
                  </div>
                </div>
              </div>
                  </div>
                </div>

                {/* Status */}
                <div className="text-center pt-2 border-t-2 border-gray-700">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border-2 ${
                    health.status === 'healthy' ? 'bg-game-purple-900 text-game-purple-300 border-game-purple-600' :
                    health.status === 'degraded' ? 'bg-yellow-900 text-yellow-300 border-yellow-600' :
                    'bg-red-900 text-red-300 border-red-600'
                  }`}>
                    ✦ {health.status.toUpperCase()} ✦
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
