import React, { useState, useEffect } from 'react'
import { checkBackendHealth } from './utils/api'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
import ChatInput from './components/ChatInput'

function App() {
  const [code, setCode] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamingMessage, setStreamingMessage] = useState('')
  const [backendHealth, setBackendHealth] = useState({ healthy: false, checking: true })

  // Conversation management
  const [conversations, setConversations] = useState([
    {
      id: '1',
      title: 'SecWeb3 Security Analysis',
      timestamp: Date.now() - 3600000,
      messages: []
    },
    {
      id: '2',
      title: 'ERC20 Token Vulnerability Scan',
      timestamp: Date.now() - 7200000,
      messages: []
    },
    {
      id: '3',
      title: 'DeFi Protocol Security Audit',
      timestamp: Date.now() - 86400000,
      messages: []
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

    // Use secure backend API - Railway serves both frontend and backend
    const API_BASE_URL = process.env.NODE_ENV === 'production' 
      ? window.location.origin  // Same Railway domain for both frontend and API
      : 'http://localhost:8000'  // Local development backend

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
      // Step 1: Create secure session via our backend
      console.log('🔄 Creating secure analysis session...')
      const sessionResponse = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: contractCode,
          filename: contractCode ? 'contract.sol' : undefined
        })
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.error || `Session creation failed: ${sessionResponse.status}`)
      }

      const sessionData = await sessionResponse.json()
      console.log('✅ Secure session created:', sessionData.metadata)

      if (!sessionData.success || !sessionData.sessionKey) {
        throw new Error('Invalid session response from backend API')
      }

      const sessionKey = sessionData.sessionKey

      // Step 2: Start streaming analysis via our secure backend
      console.log('🔄 Starting secure analysis stream...')

      const streamResponse = await fetch(`${API_BASE_URL}/api/analyze/stream/${sessionKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      })

      if (!streamResponse.ok) {
        const errorText = await streamResponse.text()
        console.error('❌ Streaming failed:', errorText)
        throw new Error(`Analysis streaming failed: ${streamResponse.status}`)
      }

      if (!streamResponse.body) {
        throw new Error('No response body received from analysis endpoint')
      }

      // Step 3: Handle streaming response with optimized updates
      const reader = streamResponse.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let updateCounter = 0

      console.log('🔄 Starting to read secure stream...')

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log('🔄 Stream reading completed naturally')
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              if (data === '[DONE]') {
                console.log('🔄 Received [DONE] marker - analysis complete')
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
                } catch (parseError) {
                  console.error('Error parsing streaming data:', parseError)
                }
              }
            }
          }
        }

        // If we reach here, stream ended naturally
        console.log('🔄 Stream ended naturally - analysis complete')
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
        console.error('❌ Stream reading error:', streamError)
        try {
          reader.releaseLock()
        } catch (releaseError) {
          console.error('Error releasing reader lock:', releaseError)
        }
        throw streamError
      }

    } catch (error) {
      console.error('Analysis error:', error)
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

export default App
