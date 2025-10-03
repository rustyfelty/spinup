import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')

      if (!code || !state) {
        navigate('/login?error=missing-params')
        return
      }

      try {
        // Call the API callback endpoint which will validate, login, and redirect
        // The endpoint will handle setting the cookie and return redirect info
        const response = await api.get('/api/setup/discord/callback', {
          params: { code, state },
          maxRedirects: 0, // Don't follow redirects automatically
          validateStatus: (status) => status >= 200 && status < 400 // Accept 3xx as success
        })

        // Check if we got a redirect response
        if (response.status >= 300 && response.status < 400) {
          // Follow the redirect
          const redirectUrl = response.headers.location || '/'
          window.location.href = redirectUrl
        } else if (response.data?.redirect) {
          // Redirect from response data
          window.location.href = response.data.redirect
        } else {
          // Default: go to home and let it redirect to the right place
          window.location.href = '/'
        }
      } catch (error: any) {
        console.error('Login callback error:', error)
        // Check if it's a redirect response that axios treated as error
        if (error.response?.status >= 300 && error.response?.status < 400) {
          const redirectUrl = error.response.headers.location || '/'
          window.location.href = redirectUrl
        } else {
          navigate('/login?error=callback-failed')
        }
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Logging you in...</h2>
        <p className="text-gray-600">Please wait while we complete your login</p>
      </div>
    </div>
  )
}
