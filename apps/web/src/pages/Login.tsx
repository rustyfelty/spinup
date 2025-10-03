import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Shield, Zap, Bot, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to SpinUp</h1>
          <p className="text-xl text-gray-600">Game server management made simple</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in to SpinUp</h2>
            <p className="text-gray-600 mb-8">
              Log in with your Discord account to access your game servers
            </p>

            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              className="w-full max-w-md mx-auto flex items-center justify-center space-x-3 px-8 py-4 bg-[#5865F2] text-white font-medium rounded-xl hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg mb-6"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>{loading ? 'Connecting to Discord...' : 'Login with Discord'}</span>
            </button>

            <p className="text-sm text-gray-500">
              By logging in, you agree to our terms of service and privacy policy
            </p>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mb-2">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900">Secure</h4>
                <p className="text-sm text-gray-600">End-to-end encrypted magic links</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg mb-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900">Fast</h4>
                <p className="text-sm text-gray-600">One-click authentication</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg mb-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <h4 className="font-medium text-gray-900">Simple</h4>
                <p className="text-sm text-gray-600">No passwords to remember</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}