import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Download, Trash2, Search, Filter, Clock, AlertCircle, Info, CheckCircle, XCircle, AlertTriangle, Copy, Maximize2, Minimize2, Play, Square, RotateCcw, Command, Zap, RefreshCw, Activity, Wifi } from 'lucide-react';

function ServerConsole() {
  const [logs, setLogs] = useState([
    { timestamp: '2024-01-15 14:32:01', level: 'info', message: 'Starting Minecraft server version 1.20.4' },
    { timestamp: '2024-01-15 14:32:03', level: 'info', message: 'Loading properties' },
    { timestamp: '2024-01-15 14:32:03', level: 'info', message: 'Default game type: SURVIVAL' },
    { timestamp: '2024-01-15 14:32:04', level: 'info', message: 'Generating keypair' },
    { timestamp: '2024-01-15 14:32:05', level: 'info', message: 'Starting minecraft server on port 25565' },
    { timestamp: '2024-01-15 14:32:08', level: 'info', message: 'Preparing level "world"' },
    { timestamp: '2024-01-15 14:32:12', level: 'info', message: 'Preparing spawn area: 0%' },
    { timestamp: '2024-01-15 14:32:15', level: 'info', message: 'Preparing spawn area: 48%' },
    { timestamp: '2024-01-15 14:32:18', level: 'info', message: 'Preparing spawn area: 92%' },
    { timestamp: '2024-01-15 14:32:20', level: 'success', message: 'Done! Server is ready for connections.' },
    { timestamp: '2024-01-15 14:32:20', level: 'info', message: 'For help, type "help"' },
    { timestamp: '2024-01-15 14:35:42', level: 'info', message: 'Player Steve[/192.168.1.100:54321] logged in' },
    { timestamp: '2024-01-15 14:35:42', level: 'info', message: 'Steve joined the game' },
    { timestamp: '2024-01-15 14:37:15', level: 'warning', message: 'Can\'t keep up! Is the server overloaded? Running 2047ms behind' },
    { timestamp: '2024-01-15 14:38:23', level: 'info', message: '<Steve> Hello everyone!' },
    { timestamp: '2024-01-15 14:42:07', level: 'info', message: 'Player Alex[/192.168.1.101:54322] logged in' },
    { timestamp: '2024-01-15 14:42:07', level: 'info', message: 'Alex joined the game' },
    { timestamp: '2024-01-15 14:43:30', level: 'info', message: '<Alex> Hey Steve!' },
    { timestamp: '2024-01-15 14:45:12', level: 'error', message: 'Failed to save chunk [-2, 5]' },
    { timestamp: '2024-01-15 14:45:13', level: 'error', message: 'java.io.IOException: No space left on device' },
    { timestamp: '2024-01-15 14:45:13', level: 'warning', message: 'Server may be running out of disk space' }
  ]);

  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const [serverStatus, setServerStatus] = useState('RUNNING');
  const consoleEndRef = useRef(null);
  const inputRef = useRef(null);

  // Quick commands for easy access
  const quickCommands = [
    { label: 'List Players', cmd: 'list', icon: <Activity className="w-3 h-3" /> },
    { label: 'Save World', cmd: 'save-all', icon: <Download className="w-3 h-3" /> },
    { label: 'Whitelist', cmd: 'whitelist list', icon: <CheckCircle className="w-3 h-3" /> },
    { label: 'Day', cmd: 'time set day', icon: <Clock className="w-3 h-3" /> },
    { label: 'Night', cmd: 'time set night', icon: <Clock className="w-3 h-3" /> },
    { label: 'Weather Clear', cmd: 'weather clear', icon: <Zap className="w-3 h-3" /> },
  ];

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Simulate real-time log updates
  useEffect(() => {
    const interval = setInterval(() => {
      const randomEvents = [
        { level: 'info', message: 'Server tick took 45ms' },
        { level: 'info', message: 'Saving chunks for level \'world\'/minecraft:overworld' },
        { level: 'info', message: 'ThreadedAnvilChunkStorage: All chunks are saved' },
        { level: 'info', message: 'Player moved too quickly! Check for lag.' },
        { level: 'warning', message: 'Keeping entity minecraft:zombie that already exists' },
        { level: 'info', message: 'Villager trades refreshed' },
      ];
      
      if (serverStatus === 'RUNNING' && Math.random() > 0.7) {
        const event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        setLogs(prev => [...prev, { timestamp, ...event }]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [serverStatus]);

  const executeCommand = () => {
    if (!command.trim()) return;

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Add command to logs
    setLogs(prev => [...prev, 
      { timestamp, level: 'command', message: `> ${command}` }
    ]);

    // Add to command history
    setCommandHistory(prev => [...prev, command]);
    
    // Simulate command response
    setTimeout(() => {
      let response = { level: 'info', message: 'Command executed successfully' };
      
      if (command === 'list') {
        response = { level: 'info', message: 'There are 2 of a max of 20 players online: Steve, Alex' };
      } else if (command === 'save-all') {
        response = { level: 'success', message: 'Saved the game' };
      } else if (command === 'stop') {
        response = { level: 'warning', message: 'Stopping the server...' };
        setServerStatus('STOPPING');
        setTimeout(() => setServerStatus('STOPPED'), 2000);
      } else if (command === 'help') {
        response = { level: 'info', message: 'Available commands: list, save-all, stop, time, weather, whitelist, op, deop, kick, ban' };
      }

      const respTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds() + 1).padStart(2, '0')}`;
      setLogs(prev => [...prev, { timestamp: respTimestamp, ...response }]);
    }, 500);

    setCommand('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getLevelIcon = (level) => {
    switch(level) {
      case 'info': return <Info className="w-3 h-3 text-blue-500" />;
      case 'success': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-500" />;
      case 'command': return <Terminal className="w-3 h-3 text-purple-500" />;
      default: return null;
    }
  };

  const getLevelColor = (level) => {
    switch(level) {
      case 'info': return 'text-gray-300';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'command': return 'text-purple-400';
      default: return 'text-gray-300';
    }
  };

  const clearLogs = () => {
    setLogs([{ 
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19), 
      level: 'info', 
      message: 'Console cleared' 
    }]);
  };

  const downloadLogs = () => {
    const logText = logs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-logs-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-gray-900 text-gray-100 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-purple-500" />
              <span className="font-semibold">Server Console</span>
            </div>
            
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              serverStatus === 'RUNNING' ? 'bg-green-900/50 border border-green-700' : 
              serverStatus === 'STOPPING' ? 'bg-yellow-900/50 border border-yellow-700' :
              'bg-red-900/50 border border-red-700'
            }`}>
              {serverStatus === 'RUNNING' ? <Wifi className="w-3 h-3 text-green-400" /> :
               serverStatus === 'STOPPING' ? <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" /> :
               <Square className="w-3 h-3 text-red-400" />}
              <span className="text-xs font-medium">{serverStatus}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500 w-48"
              />
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>

            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="command">Commands</option>
            </select>

            {/* Toolbar */}
            <div className="flex items-center space-x-1 border-l border-gray-600 pl-2">
              <button
                onClick={() => setShowTimestamp(!showTimestamp)}
                className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${showTimestamp ? 'text-purple-400' : 'text-gray-400'}`}
                title="Toggle timestamps"
              >
                <Clock className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${autoScroll ? 'text-purple-400' : 'text-gray-400'}`}
                title="Auto-scroll"
              >
                <Activity className="w-4 h-4" />
              </button>
              <button
                onClick={clearLogs}
                className="p-1.5 rounded hover:bg-gray-700 transition-colors text-gray-400"
                title="Clear console"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={downloadLogs}
                className="p-1.5 rounded hover:bg-gray-700 transition-colors text-gray-400"
                title="Download logs"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded hover:bg-gray-700 transition-colors text-gray-400"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="flex items-center space-x-2 mt-3">
          <span className="text-xs text-gray-400">Quick:</span>
          {quickCommands.map((qc, index) => (
            <button
              key={index}
              onClick={() => {
                setCommand(qc.cmd);
                inputRef.current?.focus();
              }}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              {qc.icon}
              <span>{qc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Console Output */}
      <div className="flex-1 overflow-y-auto bg-black font-mono text-sm p-4 space-y-1">
        {filteredLogs.map((log, index) => (
          <div key={index} className="flex items-start space-x-2 hover:bg-gray-900/50 px-2 py-0.5 rounded">
            {getLevelIcon(log.level)}
            {showTimestamp && (
              <span className="text-gray-500 text-xs">[{log.timestamp}]</span>
            )}
            <span className={getLevelColor(log.level)}>{log.message}</span>
          </div>
        ))}
        <div ref={consoleEndRef} />
      </div>

      {/* Command Input */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 focus-within:border-purple-500">
            <Command className="w-4 h-4 text-purple-500" />
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={serverStatus === 'RUNNING' ? "Enter server command..." : "Server is not running"}
              disabled={serverStatus !== 'RUNNING'}
              className="flex-1 bg-transparent focus:outline-none placeholder-gray-500"
            />
          </div>
          <button
            onClick={executeCommand}
            disabled={serverStatus !== 'RUNNING' || !command.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Use ↑↓ arrows to navigate command history • Type 'help' for available commands
        </div>
      </div>
    </div>
  );
}

export default ServerConsole;