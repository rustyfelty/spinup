import React, { useState } from 'react';
import { MessageSquare, Bot, Shield, Link2, ChevronRight, Check, Copy, ExternalLink, AlertCircle, Terminal, Users, Settings, Zap, ArrowRight, Gift, Star, Award, Sparkles } from 'lucide-react';

function DiscordIntegration() {
  const [activeStep, setActiveStep] = useState(1);
  const [botAdded, setBotAdded] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(field);
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const features = [
    { icon: <Zap className="w-5 h-5" />, title: 'Quick Actions', desc: 'Start, stop, and manage servers from Discord' },
    { icon: <Shield className="w-5 h-5" />, title: 'Role-Based Access', desc: 'Control who can manage servers' },
    { icon: <Users className="w-5 h-5" />, title: 'Team Collaboration', desc: 'Share server access with your guild' },
    { icon: <Bot className="w-5 h-5" />, title: 'Auto-Provisioning', desc: 'Instant account creation for guild members' },
  ];

  const commands = [
    { command: '/gameserver new', args: '<name> <game>', desc: 'Create a new game server', example: '/gameserver new survival minecraft-java' },
    { command: '/gameserver start', args: '<id>', desc: 'Start a stopped server', example: '/gameserver start srv-abc123' },
    { command: '/gameserver stop', args: '<id>', desc: 'Stop a running server', example: '/gameserver stop srv-abc123' },
    { command: '/gameserver status', args: '<id>', desc: 'Check server status', example: '/gameserver status srv-abc123' },
    { command: '/gameserver list', args: '', desc: 'List all your servers', example: '/gameserver list' },
    { command: '/gameserver restart', args: '<id>', desc: 'Restart a server', example: '/gameserver restart srv-abc123' },
  ];

  const setupSteps = [
    {
      number: 1,
      title: 'Add SpinUp Bot to Discord',
      description: 'Click the button below to add our bot to your Discord server',
      action: 'Add to Discord',
      completed: botAdded
    },
    {
      number: 2,
      title: 'Configure Permissions',
      description: 'Set up roles and channels for the bot',
      action: 'View Guide',
      completed: botAdded && activeStep > 2
    },
    {
      number: 3,
      title: 'Run Your First Command',
      description: 'Test the integration with a simple command',
      action: 'Try It',
      completed: setupComplete
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <a href="/" className="flex items-center space-x-3 group">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-5 h-5 text-white rotate-180" />
                </div>
                <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Back to Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Connect Discord to SpinUp
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Manage your game servers directly from Discord with powerful slash commands and instant notifications
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-all hover:scale-105">
              <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl w-fit mb-4">
                <div className="text-indigo-600">{feature.icon}</div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Setup Progress */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm mb-12 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Quick Setup Guide</h2>
            <p className="text-gray-600 mt-1">Get connected in just 3 easy steps</p>
          </div>

          <div className="p-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200"></div>
                <div 
                  className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                  style={{ width: `${((activeStep - 1) / 2) * 100}%` }}
                ></div>
                {setupSteps.map((step) => (
                  <div key={step.number} className="relative z-10">
                    <button
                      onClick={() => setActiveStep(step.number)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                        step.completed 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
                          : activeStep === step.number
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-125'
                          : 'bg-white border-2 border-gray-300 text-gray-400'
                      }`}
                    >
                      {step.completed ? <Check className="w-5 h-5" /> : step.number}
                    </button>
                    <p className="absolute top-12 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 whitespace-nowrap">
                      {step.title.split(' ').slice(0, 3).join(' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="space-y-8">
              {activeStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Bot className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Add SpinUp Bot to Your Server</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Grant the bot access to your Discord server with the necessary permissions
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Required Permissions:</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['Read Messages', 'Send Messages', 'Use Slash Commands', 'Embed Links', 'Manage Messages', 'Add Reactions'].map(perm => (
                        <div key={perm} className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-700">{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setBotAdded(true);
                        setActiveStep(2);
                      }}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105 flex items-center space-x-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Add to Discord</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Settings className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Configure Bot Settings</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Set up roles and choose a default channel for notifications
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-2xl p-6">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        <span>Role Permissions</span>
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                          <span className="text-sm font-medium text-gray-700">@Admin</span>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Full Access</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                          <span className="text-sm font-medium text-gray-700">@Moderator</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Start/Stop</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                          <span className="text-sm font-medium text-gray-700">@Member</span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">View Only</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-6">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                        <Terminal className="w-5 h-5 text-indigo-600" />
                        <span>Default Channel</span>
                      </h4>
                      <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option>#general</option>
                        <option>#gaming</option>
                        <option>#server-status</option>
                        <option>#bot-commands</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        The bot will send status updates and notifications to this channel
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => setActiveStep(1)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setActiveStep(3)}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Sparkles className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Test Your Setup</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Run your first command to verify everything is working
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-400">Discord Chat</span>
                      <button
                        onClick={() => copyToClipboard('/gameserver list', 'test')}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {copySuccess === 'test' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="font-mono text-sm">
                      <span className="text-indigo-400">/gameserver</span>{' '}
                      <span className="text-green-400">list</span>
                    </div>
                    {setupComplete && (
                      <div className="mt-4 p-3 bg-gray-700/50 rounded-xl">
                        <div className="flex items-start space-x-2">
                          <Bot className="w-4 h-4 text-indigo-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-400 mb-1">SpinUp Bot</p>
                            <p className="text-sm">Found 2 servers in your organization:</p>
                            <p className="text-sm text-gray-300 mt-1">• survival-world (minecraft-java) - RUNNING</p>
                            <p className="text-sm text-gray-300">• creative-build (minecraft-java) - STOPPED</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {!setupComplete ? (
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => setActiveStep(2)}
                        className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setSetupComplete(true)}
                        className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105"
                      >
                        Run Test Command
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </div>
                      <h4 className="text-xl font-semibold text-gray-900 mb-2">Setup Complete!</h4>
                      <p className="text-gray-600 mb-6">Your Discord integration is ready to use</p>
                      <a
                        href="/"
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105"
                      >
                        <ArrowRight className="w-5 h-5" />
                        <span>Go to Dashboard</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Commands Reference */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Command Reference</h2>
            <p className="text-gray-600 mt-1">All available Discord commands for managing your servers</p>
          </div>

          <div className="p-8">
            <div className="space-y-4">
              {commands.map((cmd, index) => (
                <div key={index} className="group">
                  <div className="flex items-start space-x-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className="p-2 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                      <Terminal className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <code className="text-sm font-semibold text-gray-900">
                            {cmd.command} {cmd.args && <span className="text-indigo-600">{cmd.args}</span>}
                          </code>
                          <p className="text-sm text-gray-600 mt-1">{cmd.desc}</p>
                          <div className="mt-2">
                            <div className="inline-flex items-center space-x-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                              <span>Example:</span>
                              <code className="text-gray-700">{cmd.example}</code>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(cmd.example, `cmd-${index}`)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          {copySuccess === `cmd-${index}` ? 
                            <Check className="w-4 h-4 text-green-500" /> : 
                            <Copy className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200">
              <div className="flex items-start space-x-3">
                <Gift className="w-6 h-6 text-indigo-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Pro Tip: Magic Links</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    When you run your first command, SpinUp will automatically DM you a secure magic link to access your web dashboard. 
                    No passwords needed — just click the link and you're in!
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-indigo-600">
                    <Shield className="w-4 h-4" />
                    <span>Links expire after 5 minutes for security</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-2 text-gray-600 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span>Need help with setup?</span>
          </div>
          <div className="flex items-center justify-center space-x-4">
            <button className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              View Documentation
            </button>
            <span className="text-gray-400">•</span>
            <button className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              Join Discord Support
            </button>
            <span className="text-gray-400">•</span>
            <button className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscordIntegration;