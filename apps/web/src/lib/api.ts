import axios from 'axios'
import type { Server, User, Organization } from '@spinup/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Auth API
export const authApi = {
  async getMe() {
    const { data } = await api.get('/api/sso/me')
    return data as { user: User; org: Organization; role: string }
  },

  async logout() {
    await api.post('/api/sso/logout')
  },
}

// Servers API
export const serversApi = {
  async list(orgId: string) {
    const { data } = await api.get('/api/servers', { params: { orgId } })
    return data as Server[]
  },

  async get(id: string) {
    const { data } = await api.get(`/api/servers/${id}`)
    return data as Server
  },

  async create(data: {
    orgId: string;
    name: string;
    gameKey: string;
    memoryCap?: number;
    cpuShares?: number;
  }) {
    const { data: result } = await api.post('/api/servers', data)
    return result as { id: string }
  },

  async start(id: string) {
    const { data } = await api.post(`/api/servers/${id}/start`)
    return data
  },

  async stop(id: string) {
    const { data } = await api.post(`/api/servers/${id}/stop`)
    return data
  },

  async delete(id: string) {
    const { data } = await api.delete(`/api/servers/${id}`)
    return data
  },
}

// Config API
export const configApi = {
  async get(serverId: string) {
    const { data } = await api.get(`/api/config/${serverId}`)
    return data
  },

  async update(serverId: string, config: any) {
    const { data } = await api.put(`/api/config/${serverId}`, config)
    return data
  },

  async getHistory(serverId: string) {
    const { data } = await api.get(`/api/config/${serverId}/history`)
    return data
  },
}

// System API
export const systemApi = {
  async getHealth() {
    const { data } = await api.get('/api/system/health')
    return data as {
      timestamp: string
      status: 'healthy' | 'degraded' | 'unhealthy'
      checks: {
        database: { status: 'healthy' | 'unhealthy'; latency: number; error: string | null }
        docker: { status: 'healthy' | 'unhealthy'; containers: number; error: string | null }
        disk: { status: 'healthy' | 'unhealthy'; usagePercent: number; error: string | null }
        memory: { status: 'healthy' | 'unhealthy'; usagePercent: number; availableMB: number }
        redis: { status: 'healthy' | 'unhealthy'; error: string | null }
      }
    }
  },

  async getResources() {
    const { data } = await api.get('/api/system/resources')
    return data as {
      memory: {
        total: number
        used: number
        free: number
        allocated: number
        available: number
      }
      cpu: {
        cores: number
        loadAverage: number[]
        totalShares: number
        allocatedShares: number
        availableShares: number
      }
      servers: Array<{
        id: string
        name: string
        gameKey: string
        allocated: { memory: number; cpu: number }
        used: { memory: number; cpuPercent: number } | null
      }>
    }
  },
}