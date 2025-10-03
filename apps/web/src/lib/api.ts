import axios from 'axios'
import type { Server, User, Organization } from '@spinup/shared'

const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Global response interceptor to handle setup requirement (412 Precondition Failed)
// Similar to how WordPress redirects to setup if not configured
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if the error is 412 Precondition Failed (setup required)
    if (error.response?.status === 412 && error.response?.data?.requiresSetup) {
      // Redirect to setup wizard
      window.location.href = '/setup'
      return Promise.reject(error)
    }
    return Promise.reject(error)
  }
)

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

// AI API
export const aiApi = {
  async initSession(serverId: string, context: {
    gameName?: string
    gameType?: 'steam' | 'direct-download' | 'wine' | 'custom'
    ports?: Array<{ container: number; proto: 'tcp' | 'udp' }>
    envVars?: Record<string, string>
  }) {
    const { data } = await api.post('/api/ai/custom-server/init', { serverId, ...context })
    return data as { sessionId: string; greeting: string }
  },

  async chat(sessionId: string, message: string) {
    const { data } = await api.post('/api/ai/custom-server/chat', { sessionId, message })
    return data as {
      message: string
      script?: string
      status: 'researching' | 'drafting' | 'ready' | 'error'
      metadata?: {
        ports: Array<{ container: number; proto: 'tcp' | 'udp' }>
        envVars: Record<string, string>
      }
    }
  },

  async validateScript(sessionId: string, script: string) {
    const { data } = await api.post('/api/ai/custom-server/validate', { sessionId, script })
    return data as {
      valid: boolean
      issues: Array<{ severity: 'error' | 'warning'; message: string; line?: number }>
      suggestions: string[]
    }
  },

  async finalizeScript(sessionId: string, script: string, metadata: {
    ports: Array<{ container: number; proto: 'tcp' | 'udp' }>
    envVars: Record<string, string>
  }) {
    const { data } = await api.post('/api/ai/custom-server/finalize', { sessionId, script, metadata })
    return data as {
      script: string
      scriptHash: string
      ports: Array<{ container: number; proto: 'tcp' | 'udp' }>
      envVars: Record<string, string>
    }
  },

  async getSession(sessionId: string) {
    const { data } = await api.get(`/api/ai/custom-server/session/${sessionId}`)
    return data as {
      id: string
      context: any
      messageCount: number
      hasScript: boolean
      expiresAt: string
    }
  },
}

// Files API
export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
  permissions: string
}

export const filesApi = {
  async list(serverId: string, path: string = '/') {
    const { data } = await api.get(`/api/files/${serverId}/list`, { params: { path } })
    return data.files as FileInfo[]
  },

  async read(serverId: string, path: string) {
    const { data } = await api.get(`/api/files/${serverId}/read`, { params: { path } })
    return data.content as string
  },

  async write(serverId: string, path: string, content: string) {
    const { data } = await api.put(`/api/files/${serverId}/edit`, { path, content })
    return data
  },

  async delete(serverId: string, path: string) {
    const { data } = await api.delete(`/api/files/${serverId}/delete`, { data: { path, confirm: true } })
    return data
  },

  async createDirectory(serverId: string, path: string) {
    const { data } = await api.post(`/api/files/${serverId}/mkdir`, { path })
    return data
  },

  async download(serverId: string, path: string) {
    const response = await api.get(`/api/files/${serverId}/download`, {
      params: { path },
      responseType: 'blob'
    })
    const filename = path.split('/').pop() || 'download'
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  async upload(serverId: string, path: string, file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)

    console.log('[API] Uploading file:', { fileName: file.name, path, serverId })

    const { data } = await api.post(`/api/files/${serverId}/upload`, formData, {
      // Don't set Content-Type - let axios set it with the correct boundary
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      }
    })
    return data
  },

  async extractZip(serverId: string, zipPath: string, extractPath?: string) {
    const { data } = await api.post(`/api/files/${serverId}/extract`, { archivePath: zipPath, destinationPath: extractPath })
    return data
  },

  async compressZip(serverId: string, sourcePaths: string[], zipPath: string) {
    const archiveName = zipPath.split('/').pop() || 'archive.zip'
    const { data } = await api.post(`/api/files/${serverId}/archive`, { paths: sourcePaths, archiveName, compress: true })
    return data
  },
}