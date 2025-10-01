import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

export default function MagicLinkVerify() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token')

      if (!token) {
        setStatus('error')
        setErrorMessage('No token provided')
        return
      }

      try {
        // Call the consume endpoint
        await api.get(`/api/sso/discord/consume?token=${encodeURIComponent(token)}`)

        setStatus('success')

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/')
        }, 2000)
      } catch (error: any) {
        setStatus('error')

        // Parse error message from redirect URL if available
        const errorParam = new URLSearchParams(window.location.search).get('error')
        if (errorParam) {
          const errorMessages: Record<string, string> = {
            'missing-token': 'No authentication token was provided',
            'invalid-token': 'The authentication token is invalid',
            'token-already-used': 'This magic link has already been used',
            'token-expired': 'This magic link has expired',
            'auth-failed': 'Authentication failed. Please try again'
          }
          setErrorMessage(errorMessages[errorParam] || 'Authentication failed')
        } else {
          setErrorMessage('Failed to verify magic link')
        }
      }
    }

    verifyToken()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {status === 'verifying' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Magic Link</h2>
            <p className="text-gray-600">Please wait while we authenticate you...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">You've been authenticated. Redirecting to dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go to Login
              </button>
              <button
                onClick={() => navigate('/integrations/discord')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Setup Discord Integration
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Magic links expire after 5 minutes</span>
          </div>
        </div>
      </div>
    </div>
  )
}