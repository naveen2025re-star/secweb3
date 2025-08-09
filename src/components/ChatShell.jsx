import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import ChatInterface from './ChatInterface'
import ChatInput from './ChatInput'
import { checkBackendHealth, analyzeContract, streamAnalysis } from '../utils/api'

/**
 * ChatShell renders the authenticated chat experience.
 * It holds all chat-related hooks and state so that App.jsx doesn't call hooks conditionally.
 */
const ChatShell = ({ user }) => {
  const [code, setCode] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamingMessage, setStreamingMessage] = useState('')
  const [backendHealth, setBackendHealth] = useState({ healthy: false, checking: true })

  // Conversation management
  const [conversations, setConversations] = useState([
    {
      id: '1',
      title: 'Welcome to SecWeb3',
      timestamp: Date.now() - 3600000,
      messages: [],
      userId: user?.id
    },
    {
      id: '2',
      title: 'Smart Contract Analysis',
      timestamp: Date.now() - 7200000,
      messages: [],
      userId: user?.id
    }
  ])
  const [activeConversation, setActiveConversation] = useState('1')

  // Check backend health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkBackendHealth()
        setBackendHealth({ ...health, checking: false })
      } catch (error) {
        setBackendHealth({ healthy: false, checking: false, error: error.message })
      }
    }

    checkHealth()

    // Check health every 30 seconds
    const healthInterval = setInterval(checkHealth, 30000)
    return () => clearInterval(healthInterval)
  }, [])

  const handleSendMessage = async (message, contractCode = '') => {
    if (!message.trim() && !contractCode.trim()) return
    if (analyzing) return

    setAnalyzing(true)
    setStreamingMessage('')

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      code: contractCode
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Step 1: Create session directly with Shipable API
      const sessionData = await analyzeContract(contractCode, contractCode ? 'contract.sol' : undefined)

      if (!sessionData.success || !sessionData.sessionKey) {
        throw new Error('Invalid session response from Shipable API')
      }

      const sessionKey = sessionData.sessionKey

      // Step 2: Start streaming analysis directly with Shipable API
      const streamResponse = await streamAnalysis(sessionKey, message, contractCode)

      if (!streamResponse.body) {
        throw new Error('No response body received from Shipable API')
      }

      // Step 3: Handle streaming response with optimized updates
      const reader = streamResponse.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let updateCounter = 0

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              if (data === '[DONE]') {
                setAnalyzing(false)
                setStreamingMessage('')

                // Add final message
                const aiMessage = {
                  id: Date.now() + 1,
                  type: 'ai',
                  content: fullContent,
                  timestamp: new Date().toLocaleTimeString(),
                  streaming: false
                }
                setMessages(prev => [...prev, aiMessage])
                return
              }

              if (data && data !== '') {
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.body) {
                    fullContent += parsed.body
                    updateCounter++

                    // Update streaming message every 3 chunks to reduce blinking
                    if (updateCounter % 3 === 0) {
                      setStreamingMessage(fullContent)
                    }
                  }
                } catch {
                  // ignore parse errors for partial SSE chunks
                }
              }
            }
          }
        }

        // If we reach here, stream ended naturally
        setAnalyzing(false)
        setStreamingMessage('')

        // Add final message
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: fullContent,
          timestamp: new Date().toLocaleTimeString(),
          streaming: false
        }
        setMessages(prev => [...prev, aiMessage])

      } catch (streamError) {
        try {
          reader.releaseLock()
        } catch {
          // ignore
        }
        throw streamError
      }

    } catch (error) {
      setAnalyzing(false)
      setStreamingMessage('')

      const errorMessage = {
        id: Date.now() + 2,
        type: 'ai',
        content: `❌ **Analysis Failed**\n\nError: ${error.message}\n\nPlease try again.`,
        timestamp: new Date().toLocaleTimeString(),
        error: true
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const handleNewConversation = () => {
    const newConversation = {
      id: Date.now().toString(),
      title: `SecWeb3 Analysis ${conversations.length + 1}`,
      timestamp: Date.now(),
      messages: []
    }
    setConversations(prev => [newConversation, ...prev])
    setActiveConversation(newConversation.id)
    setMessages([])
    setCode('')
  }

  const handleSelectConversation = (conversationId) => {
    setActiveConversation(conversationId)
    // In a real app, you'd load the conversation messages here
    setMessages([])
  }

  return (
    <div className="h-screen flex bg-gray-800">
      {/* Sidebar */}
      <Sidebar
        user={user}
        conversations={conversations}
        activeConversation={activeConversation}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Interface */}
        <ChatInterface
          messages={messages}
          isAnalyzing={analyzing}
          streamingMessage={streamingMessage}
        />

        {/* Chat Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isAnalyzing={analyzing}
          code={code}
          setCode={setCode}
        />
      </div>
    </div>
  )
}

export default ChatShell
