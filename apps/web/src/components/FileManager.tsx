import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { filesApi, type FileInfo } from '../lib/api'
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Download,
  Trash2,
  Edit2,
  Plus,
  FolderPlus,
  X,
  Save,
  RefreshCw,
  Upload,
  Archive,
  FileArchive,
} from 'lucide-react'

interface FileManagerProps {
  serverId: string
}

export default function FileManager({ serverId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState<string>('/data')
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [editingContent, setEditingContent] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [showNewDirDialog, setShowNewDirDialog] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [uploading, setUploading] = useState(false)

  const queryClient = useQueryClient()

  // Fetch files in current directory
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['files', serverId, currentPath],
    queryFn: () => filesApi.list(serverId, currentPath),
    refetchInterval: 5000,
  })

  // Read file content
  const readMutation = useMutation({
    mutationFn: (path: string) => filesApi.read(serverId, path),
    onSuccess: (content, path) => {
      const file = files.find((f) => f.path === path)
      if (file) {
        setSelectedFile(file)
        setEditingContent(content)
        setIsEditing(false)
      }
    },
  })

  // Write file content
  const writeMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.write(serverId, path, content),
    onSuccess: () => {
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  // Delete file/directory
  const deleteMutation = useMutation({
    mutationFn: (path: string) => filesApi.delete(serverId, path),
    onSuccess: () => {
      setSelectedFile(null)
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  // Create directory
  const createDirMutation = useMutation({
    mutationFn: (path: string) => filesApi.createDirectory(serverId, path),
    onSuccess: () => {
      setShowNewDirDialog(false)
      setNewItemName('')
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  // Create file
  const createFileMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.write(serverId, path, content),
    onSuccess: () => {
      setShowNewFileDialog(false)
      setNewItemName('')
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  // Extract zip
  const extractZipMutation = useMutation({
    mutationFn: (zipPath: string) => filesApi.extractZip(serverId, zipPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  const handleFileClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path)
      setSelectedFile(null)
    } else {
      readMutation.mutate(file.path)
    }
  }

  const handleDownload = (file: FileInfo) => {
    filesApi.download(serverId, file.path)
  }

  const handleDelete = (file: FileInfo) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      deleteMutation.mutate(file.path)
    }
  }

  const handleSave = () => {
    if (selectedFile) {
      writeMutation.mutate({ path: selectedFile.path, content: editingContent })
    }
  }

  const handleCreateFile = () => {
    if (!newItemName.trim()) return
    const newPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`
    createFileMutation.mutate({ path: newPath, content: '' })
  }

  const handleCreateDirectory = () => {
    if (!newItemName.trim()) return
    const newPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`
    createDirMutation.mutate(newPath)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await filesApi.upload(serverId, currentPath, file)
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
      event.target.value = '' // Reset input
    }
  }

  const handleExtractZip = (file: FileInfo) => {
    if (confirm(`Extract ${file.name} to current directory?`)) {
      extractZipMutation.mutate(file.path)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden bg-white">
      {/* File Browser */}
      <div className="w-1/3 border-r flex flex-col">
        {/* Toolbar */}
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowNewFileDialog(true)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNewDirDialog(true)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <label className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer" title="Upload File">
              <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-1 text-sm overflow-x-auto">
          <button
            onClick={() => setCurrentPath('/data')}
            className="hover:text-blue-600 font-medium"
          >
            /data
          </button>
          {breadcrumbs.slice(1).map((crumb, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <button
                onClick={() => setCurrentPath('/' + breadcrumbs.slice(0, i + 2).join('/'))}
                className="hover:text-blue-600"
              >
                {crumb}
              </button>
            </div>
          ))}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {currentPath !== '/data' && (
            <button
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/') || '/data'
                setCurrentPath(parent)
              }}
              className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm border-b"
            >
              <Folder className="w-4 h-4 text-gray-400" />
              <span>..</span>
            </button>
          )}
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => handleFileClick(file)}
              className={`w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm border-b ${
                selectedFile?.path === file.path ? 'bg-blue-50' : ''
              }`}
            >
              {file.type === 'directory' ? (
                <Folder className="w-4 h-4 text-blue-500" />
              ) : (
                <File className="w-4 h-4 text-gray-400" />
              )}
              <div className="flex-1 text-left">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {file.type === 'file' && formatSize(file.size)}
                </div>
              </div>
            </button>
          ))}
          {files.length === 0 && !isLoading && (
            <div className="p-4 text-center text-gray-500 text-sm">Empty directory</div>
          )}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      {/* File Viewer/Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* File Header */}
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-sm">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">
                  {formatSize(selectedFile.size)} • {selectedFile.permissions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    {selectedFile.name.endsWith('.zip') && (
                      <button
                        onClick={() => handleExtractZip(selectedFile)}
                        disabled={extractZipMutation.isPending}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Extract
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDownload(selectedFile)}
                      className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(selectedFile)}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={writeMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        readMutation.mutate(selectedFile.path)
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 overflow-auto p-4">
              {readMutation.isPending ? (
                <div className="text-center text-gray-500 py-8">Loading file...</div>
              ) : isEditing ? (
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full h-full font-mono text-sm border rounded p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <pre className="font-mono text-sm whitespace-pre-wrap">{editingContent}</pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a file to view or edit</p>
            </div>
          </div>
        )}
      </div>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Create New File</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              placeholder="filename.txt"
              className="w-full px-3 py-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFileDialog(false)
                  setNewItemName('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                disabled={!newItemName.trim() || createFileMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Directory Dialog */}
      {showNewDirDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Create New Directory</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
              placeholder="dirname"
              className="w-full px-3 py-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewDirDialog(false)
                  setNewItemName('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDirectory}
                disabled={!newItemName.trim() || createDirMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
