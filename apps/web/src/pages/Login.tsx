import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Shield, Zap, Bot, ArrowRight, Code } from 'lucide-react'
import { api } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()

  const handleDevLogin = async () => {
    try {
      const { data } = await api.post('/api/sso/dev/login')
      if (data.success) {
        navigate(`/orgs/${data.org.id}/servers`)
      }
    } catch (error) {
      console.error('Dev login failed:', error)
      alert('Dev login failed')
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign in with Discord</h2>
            <p className="text-gray-600 mb-8">
              SpinUp uses Discord for authentication. No passwords needed!
            </p>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">How it works:</h3>
              <ol className="text-left space-y-3 max-w-md mx-auto">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center">1</span>
                  <span className="text-gray-700">Add the SpinUp bot to your Discord server</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center">2</span>
                  <span className="text-gray-700">Run any command like <code className="bg-gray-100 px-2 py-1 rounded text-sm">/gameserver list</code></span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center">3</span>
                  <span className="text-gray-700">The bot DMs you a secure magic link</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full text-xs flex items-center justify-center">4</span>
                  <span className="text-gray-700">Click the link to instantly sign in!</span>
                </li>
              </ol>
            </div>

            <button
              onClick={() => navigate('/integrations/discord')}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg transition-all hover:scale-105"
            >
              <Bot className="w-5 h-5" />
              <span>Set Up Discord Integration</span>
              <ArrowRight className="w-5 h-5" />
            </button>
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

        <div className="mt-8 text-center space-y-4">
          <p className="text-sm text-gray-600">
            Already have the bot set up?{' '}
            <span className="text-purple-600">
              Run <code className="bg-gray-100 px-2 py-1 rounded">/gameserver list</code> in Discord
            </span>
          </p>

          <button
            onClick={handleDevLogin}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Code className="w-4 h-4" />
            <span>Dev Login (Development Only)</span>
          </button>
        </div>
      </div>
    </div>
  )
}