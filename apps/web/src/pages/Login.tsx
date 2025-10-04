import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Shield, Zap, Bot, Gamepad2, Server } from 'lucide-react'
import { api } from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleDiscordLogin = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/sso/discord/oauth/login')
      window.location.href = data.url
    } catch (error) {
      console.error('Failed to get Discord auth URL:', error)
      alert('Failed to start Discord login')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-game-dark-900 dark:to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px),
            repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(59, 130, 246, 0.3) 35px, rgba(59, 130, 246, 0.3) 36px)
          `,
          backgroundSize: '36px 36px'
        }}></div>
      </div>

      {/* Gradient orbs for depth */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-game-green-600 rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600 rounded-full filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="max-w-5xl w-full relative z-10">
        {/* Header section */}
        <div className="text-center mb-12">
          <div className="pixel-corners bg-game-green-600/20 mb-6 inline-block backdrop-blur-sm">
            <div className="pixel-corners-content inline-flex items-center justify-center p-4 bg-gradient-to-br from-game-green-600 to-blue-600">
              <Gamepad2 className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-3 tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-game-green-400 to-blue-400 bg-clip-text text-transparent">SpinUp</span>
          </h1>
          <p className="text-xl text-slate-300 dark:text-slate-400">Game server management for Discord communities</p>
        </div>

        {/* Main login card */}
        <div className="pixel-corners bg-game-green-600/20 backdrop-blur-sm shadow-2xl shadow-game-green-600/20">
          <div className="pixel-corners-content bg-gradient-to-br from-slate-900/95 to-slate-800/95 dark:from-slate-950/95 dark:to-game-dark-900/95 p-8 md:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-3">Sign in to SpinUp</h2>
              <p className="text-slate-300 dark:text-slate-400 mb-10">
                Connect with Discord to manage your game servers
              </p>

              {/* Discord login button */}
              <div className="pixel-corners bg-[#5865F2] mb-4 hover:shadow-lg hover:shadow-[#5865F2]/50 transition-all duration-200">
                <button
                  onClick={handleDiscordLogin}
                  disabled={loading}
                  className="pixel-corners-content w-full max-w-md mx-auto flex items-center justify-center space-x-3 px-8 py-5 bg-[#5865F2] text-white font-semibold hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                >
                  <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span className="text-lg">{loading ? 'Connecting to Discord...' : 'Continue with Discord'}</span>
                </button>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-600 mt-6">
                By logging in, you agree to our terms of service and privacy policy
              </p>
            </div>

            {/* Features grid */}
            <div className="pt-8 border-t border-slate-700/50 dark:border-slate-800/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center group">
                  <div className="pixel-corners-sm bg-game-green-600/30 mb-3 inline-block transition-all duration-200 group-hover:bg-game-green-600/40">
                    <div className="pixel-corners-sm-content inline-flex items-center justify-center w-12 h-12 bg-game-green-600/20">
                      <Shield className="w-6 h-6 text-game-green-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-1">Secure & Private</h4>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Discord OAuth with encrypted sessions</p>
                </div>
                <div className="text-center group">
                  <div className="pixel-corners-sm bg-blue-600/30 mb-3 inline-block transition-all duration-200 group-hover:bg-blue-600/40">
                    <div className="pixel-corners-sm-content inline-flex items-center justify-center w-12 h-12 bg-blue-600/20">
                      <Zap className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-1">Lightning Fast</h4>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Deploy servers in seconds</p>
                </div>
                <div className="text-center group">
                  <div className="pixel-corners-sm bg-purple-600/30 mb-3 inline-block transition-all duration-200 group-hover:bg-purple-600/40">
                    <div className="pixel-corners-sm-content inline-flex items-center justify-center w-12 h-12 bg-purple-600/20">
                      <Server className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-1">Easy Management</h4>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Control servers from Discord or web</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center mt-8">
          <p className="text-slate-500 dark:text-slate-600 text-sm">
            Powered by Docker · Secured by Discord OAuth · Built for gaming communities
          </p>
        </div>
      </div>
    </div>
  )
}