import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { filesApi, type FileInfo } from '../lib/api'
import { GAMES } from '@spinup/shared'
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
  Image as ImageIcon,
  CheckSquare,
  Square,
} from 'lucide-react'

interface FileManagerProps {
  serverId: string
  gameKey: string
}

export default function FileManager({ serverId, gameKey }: FileManagerProps) {
  const game = GAMES.find(g => g.key === gameKey)
  const dataPath = game?.volumePaths?.data || '/data'
  const [currentPath, setCurrentPath] = useState<string>(dataPath)
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [editingContent, setEditingContent] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [mobileView, setMobileView] = useState<'browser' | 'viewer'>('browser')
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [showNewDirDialog, setShowNewDirDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string
    progress: number
    status: 'uploading' | 'complete' | 'error'
  } | null>(null)

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

  const isImageFile = (filename: string) => {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']
    return imageExts.some(ext => filename.toLowerCase().endsWith(ext))
  }

  const isArchiveFile = (filename: string) => {
    const archiveExts = ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z']
    return archiveExts.some(ext => filename.toLowerCase().endsWith(ext))
  }

  const toggleFileSelection = (filePath: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath)
    } else {
      newSelection.add(filePath)
    }
    setSelectedFiles(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)))
    }
  }

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

    console.log('[Upload] Starting upload:', { fileName: file.name, path: currentPath })

    setUploading(true)
    setUploadProgress({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    })

    try {
      await filesApi.upload(serverId, currentPath, file, (progress) => {
        setUploadProgress({
          fileName: file.name,
          progress,
          status: 'uploading'
        })
      })

      setUploadProgress({
        fileName: file.name,
        progress: 100,
        status: 'complete'
      })

      queryClient.invalidateQueries({ queryKey: ['files', serverId] })

      // Clear upload progress after 3 seconds
      setTimeout(() => {
        setUploadProgress(null)
      }, 3000)
    } catch (error: any) {
      console.error('Upload failed:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed'
      alert(`Upload failed: ${errorMessage}`)

      setUploadProgress({
        fileName: file.name,
        progress: 0,
        status: 'error'
      })

      // Clear error after 5 seconds
      setTimeout(() => {
        setUploadProgress(null)
      }, 5000)
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

  const handleBatchDelete = () => {
    if (selectedFiles.size === 0) return
    if (confirm(`Delete ${selectedFiles.size} selected file(s)?`)) {
      // TODO: Add batch delete API endpoint or iterate
      selectedFiles.forEach(path => {
        deleteMutation.mutate(path)
      })
      setSelectedFiles(new Set())
    }
  }

  const compressZipMutation = useMutation({
    mutationFn: ({ paths, zipPath }: { paths: string[]; zipPath: string }) =>
      filesApi.compressZip(serverId, paths, zipPath),
    onSuccess: () => {
      setShowArchiveDialog(false)
      setNewItemName('')
      setSelectedFiles(new Set())
      queryClient.invalidateQueries({ queryKey: ['files', serverId] })
    },
  })

  const handleCreateArchive = () => {
    if (!newItemName.trim()) return
    const archiveName = newItemName.endsWith('.zip') ? newItemName : `${newItemName}.zip`
    const archivePath = currentPath === '/' ? `/${archiveName}` : `${currentPath}/${archiveName}`

    compressZipMutation.mutate({
      paths: Array.from(selectedFiles),
      zipPath: archivePath,
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300">
      <div className="pixel-corners-sm-content flex flex-col md:flex-row min-h-[500px] md:min-h-[600px] md:h-[600px] overflow-hidden dark:bg-gray-900 bg-white">

        {/* Mobile View Switcher */}
        <div className="md:hidden flex dark:border-gray-700 border-b dark:bg-gray-800 bg-gray-50">
          <button
            onClick={() => setMobileView('browser')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              mobileView === 'browser'
                ? 'dark:text-white text-gray-900 dark:border-game-green-500 border-purple-600 border-b-2'
                : 'dark:text-gray-400 text-gray-600'
            }`}
          >
            Files {selectedFile && `(${selectedFile.name})`}
          </button>
          <button
            onClick={() => setMobileView('viewer')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              mobileView === 'viewer'
                ? 'dark:text-white text-gray-900 dark:border-game-green-500 border-purple-600 border-b-2'
                : 'dark:text-gray-400 text-gray-600'
            }`}
            disabled={!selectedFile}
          >
            Preview
          </button>
        </div>

      {/* File Browser */}
      <div className={`w-full md:w-1/3 dark:border-gray-700 md:border-r flex-col ${mobileView === 'browser' ? 'flex' : 'hidden'} md:flex`}>
        {/* Toolbar */}
        <div className="p-3 dark:border-gray-700 border-b dark:bg-gray-800 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2.5 sm:p-1.5 min-w-[44px] min-h-[44px] dark:hover:bg-gray-700 hover:bg-gray-200 rounded transition-colors dark:text-gray-300"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowNewFileDialog(true)}
                className="p-2.5 sm:p-1.5 min-w-[44px] min-h-[44px] dark:hover:bg-gray-700 hover:bg-gray-200 rounded transition-colors dark:text-gray-300"
                title="New File"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNewDirDialog(true)}
                className="p-2.5 sm:p-1.5 min-w-[44px] min-h-[44px] dark:hover:bg-gray-700 hover:bg-gray-200 rounded transition-colors dark:text-gray-300"
                title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <label className="p-2.5 sm:p-1.5 min-w-[44px] min-h-[44px] dark:hover:bg-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer dark:text-gray-300" title="Upload File">
                <Upload className={`w-4 h-4 ${uploading ? 'animate-pulse' : ''}`} />
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="p-2.5 sm:p-1.5 min-w-[44px] min-h-[44px] dark:hover:bg-gray-700 hover:bg-gray-200 rounded transition-colors dark:text-gray-300"
                title="Select All"
              >
                {selectedFiles.size === files.length && files.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          {selectedFiles.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 dark:border-gray-700 border-t">
              <span className="text-sm dark:text-gray-400 text-gray-600">{selectedFiles.size} selected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowArchiveDialog(true)}
                  className="flex-1 sm:flex-initial px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  <FileArchive className="w-4 h-4 sm:w-3 sm:h-3 inline mr-1" />
                  Archive
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="flex-1 sm:flex-initial px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 sm:w-3 sm:h-3 inline mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedFiles(new Set())}
                  className="flex-1 sm:flex-initial px-3 py-2 sm:px-2 sm:py-1 text-sm sm:text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="px-3 py-2 dark:border-gray-700 border-b dark:bg-gray-800 bg-gray-50 flex items-center gap-1 text-sm overflow-x-auto">
          <button
            onClick={() => setCurrentPath(dataPath)}
            className="dark:hover:text-game-green-400 hover:text-purple-600 font-medium dark:text-white"
          >
            {dataPath}
          </button>
          {breadcrumbs.slice(1).map((crumb, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 dark:text-gray-600 text-gray-400" />
              <button
                onClick={() => setCurrentPath('/' + breadcrumbs.slice(0, i + 2).join('/'))}
                className="dark:hover:text-game-green-400 hover:text-purple-600 dark:text-gray-300"
              >
                {crumb}
              </button>
            </div>
          ))}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
          {currentPath !== dataPath && (
            <button
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/') || dataPath
                setCurrentPath(parent)
              }}
              className="w-full px-3 py-3 sm:py-2 min-h-[48px] dark:hover:bg-gray-700/50 hover:bg-gray-50 flex items-center gap-2 text-sm dark:border-gray-700 border-b dark:text-gray-300"
            >
              <Folder className="w-4 h-4 dark:text-gray-500 text-gray-400" />
              <span>..</span>
            </button>
          )}
          {[...files].sort((a, b) => {
            // Directories first, then files
            if (a.type === 'directory' && b.type !== 'directory') return -1
            if (a.type !== 'directory' && b.type === 'directory') return 1
            // Sort alphabetically within each group
            return a.name.localeCompare(b.name)
          }).map((file) => (
            <div
              key={file.path}
              className={`w-full px-3 py-3 sm:py-2 min-h-[48px] dark:hover:bg-gray-700/50 hover:bg-gray-50 flex items-center gap-2 text-sm dark:border-gray-700 border-b dark:text-gray-300 ${
                selectedFile?.path === file.path ? 'bg-purple-50' : ''
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFileSelection(file.path)
                }}
                className="flex-shrink-0"
              >
                {selectedFiles.has(file.path) ? (
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                ) : (
                  <Square className="w-4 h-4 dark:text-gray-500 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => handleFileClick(file)}
                className="flex-1 flex items-center gap-2"
              >
                {file.type === 'directory' ? (
                  <Folder className="w-4 h-4 text-game-purple-500" />
                ) : isImageFile(file.name) ? (
                  <ImageIcon className="w-4 h-4 text-game-purple-500" />
                ) : isArchiveFile(file.name) ? (
                  <FileArchive className="w-4 h-4 text-game-purple-500" />
                ) : (
                  <File className="w-4 h-4 dark:text-gray-500 text-gray-400" />
                )}
                <div className="flex-1 text-left">
                  <div className="font-medium dark:text-white">{file.name}</div>
                  <div className="text-xs dark:text-gray-400 text-gray-500">
                    {file.type === 'file' && formatSize(file.size)}
                  </div>
                </div>
              </button>
            </div>
          ))}
          {files.length === 0 && !isLoading && (
            <div className="p-4 text-center dark:text-gray-400 text-gray-500 text-sm">Empty directory</div>
          )}
          {isLoading && (
            <div className="p-4 text-center dark:text-gray-400 text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      {/* File Viewer/Editor */}
      <div className={`flex-1 flex-col ${mobileView === 'viewer' ? 'flex' : 'hidden'} md:flex`}>
        {selectedFile ? (
          <>
            {/* File Header */}
            <div className="p-3 dark:border-gray-700 border-b dark:bg-gray-800 bg-gray-50">
              {/* File Info - Stack on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 dark:text-gray-500 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-sm dark:text-white truncate">{selectedFile.name}</span>
                </div>
                <div className="text-xs dark:text-gray-400 text-gray-500 flex-shrink-0">
                  {formatSize(selectedFile.size)} • {selectedFile.permissions}
                </div>
              </div>

              {/* Action Buttons - Wrap on mobile, use full width on small screens */}
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing ? (
                  <>
                    {selectedFile.name.endsWith('.zip') && (
                      <button
                        onClick={() => handleExtractZip(selectedFile)}
                        disabled={extractZipMutation.isPending}
                        className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
                      >
                        <Archive className="w-4 h-4" />
                        <span>Extract</span>
                      </button>
                    )}
                    {!isImageFile(selectedFile.name) && !isArchiveFile(selectedFile.name) && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center gap-2 font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(selectedFile)}
                      className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center gap-2 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => handleDelete(selectedFile)}
                      className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-2 font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={writeMutation.isPending}
                      className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-game-purple-600 text-white rounded hover:bg-game-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        readMutation.mutate(selectedFile.path)
                      }}
                      className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center gap-2 font-medium"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 overflow-auto p-4">
              {readMutation.isPending ? (
                <div className="text-center dark:text-gray-400 text-gray-500 py-8">Loading file...</div>
              ) : isEditing ? (
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="w-full h-full font-mono text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white border rounded p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ) : isImageFile(selectedFile.name) ? (
                <div className="flex justify-center items-start">
                  <img
                    src={`${import.meta.env.VITE_API_URL || ''}/api/files/${serverId}/download?path=${encodeURIComponent(selectedFile.path)}`}
                    alt={selectedFile.name}
                    className="max-w-full h-auto"
                    style={{ width: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : isArchiveFile(selectedFile.name) ? (
                <div className="text-center dark:text-gray-400 text-gray-500 py-8">
                  <FileArchive className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="mb-2">Archive file: {selectedFile.name}</p>
                  <p className="text-sm">Use the Extract button above to unzip this file</p>
                </div>
              ) : (
                <pre className="font-mono text-sm dark:text-gray-300 whitespace-pre-wrap">{editingContent}</pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center dark:text-gray-500 text-gray-400">
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
          <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 w-full max-w-sm mx-4 sm:w-96">
            <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white p-4 sm:p-6">
              <h3 className="text-lg font-medium dark:text-white mb-4">Create New File</h3>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                placeholder="filename.txt"
                className="w-full px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewFileDialog(false)
                    setNewItemName('')
                  }}
                  className="px-4 py-2 text-sm dark:text-gray-300 text-gray-600 dark:hover:bg-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFile}
                  disabled={!newItemName.trim() || createFileMutation.isPending}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Directory Dialog */}
      {showNewDirDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 w-full max-w-sm mx-4 sm:w-96">
            <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white p-4 sm:p-6">
              <h3 className="text-lg font-medium dark:text-white mb-4">Create New Directory</h3>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDirectory()}
                placeholder="dirname"
                className="w-full px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewDirDialog(false)
                    setNewItemName('')
                  }}
                  className="px-4 py-2 text-sm dark:text-gray-300 text-gray-600 dark:hover:bg-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDirectory}
                  disabled={!newItemName.trim() || createDirMutation.isPending}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Creation Dialog */}
      {showArchiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="pixel-corners-sm dark:bg-gray-700 bg-gray-300 w-full max-w-sm mx-4 sm:w-96">
            <div className="pixel-corners-sm-content dark:bg-gray-800 bg-white p-4 sm:p-6">
              <h3 className="text-lg font-medium dark:text-white mb-4">Create Archive</h3>
              <p className="text-sm dark:text-gray-400 text-gray-600 mb-4">
                Creating archive from {selectedFiles.size} selected file(s)
              </p>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateArchive()}
                placeholder="archive.zip"
                className="w-full px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowArchiveDialog(false)
                    setNewItemName('')
                  }}
                  className="px-4 py-2 text-sm dark:text-gray-300 text-gray-600 dark:hover:bg-gray-700 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateArchive}
                  disabled={!newItemName.trim() || compressZipMutation.isPending}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {compressZipMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileArchive className="w-4 h-4" />
                      Create Archive
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Indicator */}
      {uploadProgress && (
        <div className="fixed bottom-0 left-0 right-0 dark:bg-gray-800 bg-white dark:border-gray-700 border-t shadow-lg z-40">
          <div className="max-w-md mx-auto p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {uploadProgress.status === 'uploading' && (
                  <RefreshCw className="w-4 h-4 animate-spin text-game-purple-600" />
                )}
                {uploadProgress.status === 'complete' && (
                  <CheckSquare className="w-4 h-4 text-game-purple-600" />
                )}
                {uploadProgress.status === 'error' && (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm font-medium truncate max-w-xs">
                  {uploadProgress.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm dark:text-gray-400 text-gray-600">
                  {uploadProgress.status === 'uploading' && `${uploadProgress.progress}%`}
                  {uploadProgress.status === 'complete' && 'Complete'}
                  {uploadProgress.status === 'error' && 'Failed'}
                </span>
                <button
                  onClick={() => setUploadProgress(null)}
                  className="dark:text-gray-400 text-gray-400 dark:hover:text-gray-300 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {uploadProgress.status === 'uploading' && (
              <div className="w-full dark:bg-gray-700 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
