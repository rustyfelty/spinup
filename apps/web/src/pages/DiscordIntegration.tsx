import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare, Bot, Shield, Link2, ChevronRight, Check, Copy,
  ExternalLink, AlertCircle, Terminal, Users, Settings, Zap,
  ArrowRight, Gift, Star, Award, Sparkles, ArrowLeft
} from 'lucide-react'

export default function DiscordIntegration() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(1)
  const [botAdded, setBotAdded] = useState(false)
  const [copySuccess, setCopySuccess] = useState('')
  const [setupComplete, setSetupComplete] = useState(false)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopySuccess(field)
    setTimeout(() => setCopySuccess(''), 2000)
  }

  const features = [
    { icon: <Zap className="w-5 h-5" />, title: 'Quick Actions', desc: 'Start, stop, and manage servers from Discord' },
    { icon: <Shield className="w-5 h-5" />, title: 'Role-Based Access', desc: 'Control who can manage servers' },
    { icon: <Users className="w-5 h-5" />, title: 'Team Collaboration', desc: 'Share server access with your guild' },
    { icon: <Bot className="w-5 h-5" />, title: 'Auto-Provisioning', desc: 'Instant account creation for guild members' },
  ]

  const commands = [
    { command: '/gameserver new', args: '<name> <game>', desc: 'Create a new game server', example: '/gameserver new survival minecraft-java' },
    { command: '/gameserver start', args: '<id>', desc: 'Start a stopped server', example: '/gameserver start srv-abc123' },
    { command: '/gameserver stop', args: '<id>', desc: 'Stop a running server', example: '/gameserver stop srv-abc123' },
    { command: '/gameserver status', args: '<id>', desc: 'Check server status', example: '/gameserver status srv-abc123' },
    { command: '/gameserver list', args: '', desc: 'List all your servers', example: '/gameserver list' },
    { command: '/gameserver restart', args: '<id>', desc: 'Restart a server', example: '/gameserver restart srv-abc123' },
  ]

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
  ]

  const handleAddBot = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID

    if (!clientId || clientId === 'your-discord-client-id') {
      alert('Discord integration is not configured yet.\n\nTo set it up:\n1. Create a Discord application at https://discord.com/developers/applications\n2. Add your client ID to the .env file\n3. Restart the development server')
      return
    }

    const permissions = '274877984800' // Manage messages, send messages, embed links, etc.
    const scope = 'bot%20applications.commands'
    const redirectUri = encodeURIComponent(`${window.location.origin}/integrations/discord`)

    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scope}&redirect_uri=${redirectUri}&response_type=code`

    window.open(inviteUrl, '_blank')
    setBotAdded(true)
    setActiveStep(2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-3 group"
              >
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </div>
                <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Back to Dashboard</span>
              </button>
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

        {/* Setup Steps */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Setup</h2>

          <div className="space-y-6">
            {setupSteps.map((step) => (
              <div key={step.number} className={`flex items-start space-x-4 ${step.completed ? 'opacity-60' : ''}`}>
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold
                  ${step.completed ? 'bg-green-500 text-white' : activeStep === step.number ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {step.completed ? <Check className="w-5 h-5" /> : step.number}
                </div>
                <div className="flex-grow">
                  <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-600 mb-3">{step.description}</p>
                  {activeStep === step.number && !step.completed && (
                    <button
                      onClick={step.number === 1 ? handleAddBot : undefined}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {step.action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commands Reference */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Available Commands</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Terminal className="w-4 h-4" />
              <span>Slash commands</span>
            </div>
          </div>

          <div className="space-y-4">
            {commands.map((cmd, index) => (
              <div key={index} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <div className="flex items-center space-x-2 mb-2">
                      <code className="text-purple-600 font-mono font-semibold">{cmd.command}</code>
                      {cmd.args && (
                        <code className="text-gray-500 font-mono text-sm">{cmd.args}</code>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{cmd.desc}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Example:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{cmd.example}</code>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(cmd.example, `cmd-${index}`)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {copySuccess === `cmd-${index}` ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Magic Link Info */}
        <div className="mt-12 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-200">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-xl">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Magic Link Authentication</h3>
              <p className="text-gray-600 mb-4">
                When you run your first command, SpinUp Bot will DM you a secure magic link that logs you into the web dashboard automatically.
                No passwords needed!
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Secure & encrypted</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>5-minute expiry</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Check className="w-4 h-4" />
                  <span>Single use</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}