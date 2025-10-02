import React, { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, Send, Loader2, CheckCircle, AlertCircle, Sparkles, Code, Play } from 'lucide-react'
import { aiApi } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  script?: string
  metadata?: {
    ports: Array<{ container: number; proto: 'tcp' | 'udp' }>
    envVars: Record<string, string>
  }
}

interface AIAssistantProps {
  serverId: string
  serverName: string
}

export default function AIAssistant({ serverId, serverName }: AIAssistantProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'researching' | 'drafting' | 'ready' | 'error'>('idle')
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [scriptMetadata, setScriptMetadata] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize session
  const initMutation = useMutation({
    mutationFn: () => aiApi.initSession(serverId, {}),
    onSuccess: (data) => {
      setSessionId(data.sessionId)
      setMessages([{
        role: 'assistant',
        content: data.greeting
      }])
    }
  })

  // Send chat message
  const chatMutation = useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
      aiApi.chat(sessionId, message),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        script: data.script,
        metadata: data.metadata
      }])
      setStatus(data.status)
      if (data.script) {
        setGeneratedScript(data.script)
        setScriptMetadata(data.metadata)
      }
    }
  })

  // Validate script
  const validateMutation = useMutation({
    mutationFn: ({ sessionId, script }: { sessionId: string; script: string }) =>
      aiApi.validateScript(sessionId, script)
  })

  // Finalize script
  const finalizeMutation = useMutation({
    mutationFn: ({ sessionId, script, metadata }: any) =>
      aiApi.finalizeScript(sessionId, script, metadata),
    onSuccess: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Script has been saved! Your server is now configured. You can start it from the console tab.'
      }])
    }
  })

  useEffect(() => {
    if (!sessionId) {
      initMutation.mutate()
    }
  }, [])

  const handleSend = () => {
    if (!input.trim() || !sessionId) return

    const userMessage = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')

    chatMutation.mutate({ sessionId, message: userMessage })
  }

  const handleValidateScript = () => {
    if (!sessionId || !generatedScript) return
    validateMutation.mutate({ sessionId, script: generatedScript })
  }

  const handleFinalizeScript = () => {
    if (!sessionId || !generatedScript || !scriptMetadata) return
    finalizeMutation.mutate({
      sessionId,
      script: generatedScript,
      metadata: scriptMetadata
    })
  }

  if (initMutation.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (initMutation.isError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Failed to initialize AI assistant</p>
      </div>
    )
  }

  return (
    <div className="h-[600px] flex flex-col">
      {/* Status Bar */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">AI Game Server Setup Assistant</h3>
              <p className="text-sm text-gray-600">
                {status === 'idle' && 'Ready to help you set up your custom game server'}
                {status === 'researching' && '🔍 Researching game server setup methods...'}
                {status === 'drafting' && '✍️ Generating installation script...'}
                {status === 'ready' && '✅ Script ready! Review and apply when ready.'}
                {status === 'error' && '❌ Something went wrong. Try asking again.'}
              </p>
            </div>
          </div>
          {status === 'researching' || status === 'drafting' ? (
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          ) : null}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white p-4 mb-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="w-4 h-4" />
                  <span className="font-medium text-sm">AI Assistant</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.script && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <Code className="w-4 h-4" />
                    <span className="font-medium text-sm">Generated Script</span>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto font-mono">
                    {msg.script}
                  </pre>
                  {msg.metadata && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Ports: {msg.metadata.ports.map(p => `${p.container}/${p.proto}`).join(', ')}</p>
                      <p className="font-medium">Env Vars: {Object.keys(msg.metadata.envVars).length} variables</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Script Actions */}
      {generatedScript && status === 'ready' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Script ready to apply</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleValidateScript}
                disabled={validateMutation.isPending}
                className="px-3 py-1.5 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-100"
              >
                {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate'}
              </button>
              <button
                onClick={handleFinalizeScript}
                disabled={finalizeMutation.isPending}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                {finalizeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Apply Script</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {validateMutation.data && (
            <div className="mt-3 pt-3 border-t border-green-200">
              {validateMutation.data.valid ? (
                <p className="text-sm text-green-700 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Script validation passed! Safe to apply.</span>
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-700">Validation issues found:</p>
                  {validateMutation.data.issues.map((issue: any, idx: number) => (
                    <div key={idx} className="text-sm text-red-600 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me about setting up your game server..."
          disabled={chatMutation.isPending || !sessionId}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatMutation.isPending || !sessionId}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {chatMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Send</span>
            </>
          )}
        </button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-500 mt-2">
        <Sparkles className="w-3 h-3 inline mr-1" />
        Tell me what game server you want to set up, and I'll help you configure it!
      </p>
    </div>
  )
}
