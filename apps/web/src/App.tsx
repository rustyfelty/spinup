import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import ServerDetail from './pages/ServerDetail'
import MagicLinkVerify from './pages/MagicLinkVerify'
import DiscordIntegration from './pages/DiscordIntegration'
import Settings from './pages/Settings'
import DiscordRoleSettings from './pages/DiscordRoleSettings'
import Login from './pages/Login'
import LoginCallback from './pages/LoginCallback'
import Setup from './pages/Setup'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/setup-wizard" element={<Setup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/orgs/:orgId/servers" element={<Dashboard />} />
          <Route path="/server/:id" element={<ServerDetail />} />
          <Route path="/servers/:id" element={<ServerDetail />} />
          <Route path="/sso/discord/consume" element={<MagicLinkVerify />} />
          <Route path="/login/callback" element={<LoginCallback />} />
          <Route path="/verify/:token" element={<MagicLinkVerify />} />
          <Route path="/integrations/discord" element={<DiscordIntegration />} />
          <Route path="/discord" element={<DiscordIntegration />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/discord-roles" element={<DiscordRoleSettings />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}