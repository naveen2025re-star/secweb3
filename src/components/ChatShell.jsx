import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import ChatInterface from './ChatInterface'
import ChatInput from './ChatInput'
import {
    checkBackendHealth, analyzeContract, streamAnalysis, getUserConversations, createConversation,
    addMessageToConversation
} from '../utils/api'

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
  const [loadingConversations, setLoadingConversations] = useState(true)

  // Conversation management
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)

  // Check backend health and load conversations on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkBackendHealth()
        setBackendHealth({ ...health, checking: false })
      } catch (error) {
        setBackendHealth({ healthy: false, checking: false, error: error.message })
      }
    }

    const loadConversations = async () => {
      try {
        setLoadingConversations(true)
        const response = await getUserConversations()

        if (response.success && response.conversations) {
          const formattedConversations = response.conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            timestamp: new Date(conv.updated_at).getTime(),
            messageCount: conv.message_count || 0,
            userId: conv.user_id
          }))

          setConversations(formattedConversations)

          // Set active conversation to the first one or create a new one
          if (formattedConversations.length > 0) {
            setActiveConversation(formattedConversations[0].id)
            await loadConversationMessages(formattedConversations[0].id)
          } else {
            // Create welcome conversation for new users
            handleNewConversation()
          }
        } else {
          // Create welcome conversation if no conversations exist
          handleNewConversation()
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
        // Create welcome conversation as fallback
        handleNewConversation()
      } finally {
        setLoadingConversations(false)
      }
    }

    checkHealth()
    loadConversations()

    // Check health every 30 seconds
    const healthInterval = setInterval(checkHealth, 30000)
    return () => clearInterval(healthInterval)
  }, [user])

  // Load messages for a specific conversation
  const loadConversationMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('secweb3_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.conversation.messages) {
          const formattedMessages = data.conversation.messages.map(msg => ({
            id: msg.id,
            type: msg.role === 'assistant' ? 'ai' : 'user',
            content: msg.content,
            timestamp: new Date(msg.created_at).toLocaleTimeString(),
            code: msg.metadata?.code || null
          }))
          setMessages(formattedMessages)
        }
      }
    } catch (error) {
      console.error('Failed to load conversation messages:', error)
      setMessages([])
    }
  }

  const handleSendMessage = async (message, contractCode = '') => {
    if (!message.trim() && !contractCode.trim()) return
    if (analyzing) return

    setAnalyzing(true)
    setStreamingMessage('')

    // Create conversation if none exists
    let conversationId = activeConversation
    if (!conversationId) {
      conversationId = await handleNewConversation()
    }

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      code: contractCode
    }
    setMessages(prev => [...prev, userMessage])

    // Save user message to database
    if (conversationId) {
      try {
        await addMessageToConversation(
          conversationId, 
          'user', 
          message, 
          { code: contractCode }
        )
      } catch (error) {
        console.error('Failed to save user message:', error)
      }
    }

    // Message persisted above via addMessageToConversation

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

                // Save AI message to database
                if (conversationId) {
                  try {
                    await addMessageToConversation(
                      conversationId,
                      'assistant',
                      fullContent,
                      { sessionKey, analysis: true }
                    )
                  } catch (error) {
                    console.error('Failed to save AI message:', error)
                  }
                }

                // Message persisted above via addMessageToConversation
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

  const handleNewConversation = async () => {
    try {
      const newTitle = `Smart Contract Analysis ${new Date().toLocaleDateString()}`

      const response = await createConversation(newTitle, [])

      if (response.success && response.conversation) {
        const newConversation = {
          id: response.conversation.id,
          title: response.conversation.title,
          timestamp: new Date(response.conversation.created_at).getTime(),
          messageCount: 0,
          userId: response.conversation.user_id
        }

        setConversations(prev => [newConversation, ...prev])
        setActiveConversation(newConversation.id)
        setMessages([])
        setCode('')
        return newConversation.id
      } else {
        // Fallback to local conversation if save fails
        const fallbackConversation = {
          id: `local_${Date.now()}`,
          title: newTitle,
          timestamp: Date.now(),
          messageCount: 0,
          userId: user?.id
        }
        setConversations(prev => [fallbackConversation, ...prev])
        setActiveConversation(fallbackConversation.id)
        setMessages([])
        setCode('')
        return fallbackConversation.id
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error)
      // Fallback to local conversation
      const fallbackConversation = {
        id: `local_${Date.now()}`,
        title: `Smart Contract Analysis ${new Date().toLocaleDateString()}`,
        timestamp: Date.now(),
        messageCount: 0,
        userId: user?.id
      }
      setConversations(prev => [fallbackConversation, ...prev])
      setActiveConversation(fallbackConversation.id)
      setMessages([])
      setCode('')
      return fallbackConversation.id
    }
  }

  const handleSelectConversation = async (conversationId) => {
    setActiveConversation(conversationId)
    await loadConversationMessages(conversationId)
  }

  const handleDeleteConversation = async (conversationId) => {
    try {
      // Delete from database
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('secweb3_token')}`
        }
      })

      if (response.ok) {
        // Remove from local state
        setConversations(prev => prev.filter(conv => conv.id !== conversationId))

        // If deleting active conversation, switch to first remaining conversation
        if (activeConversation === conversationId) {
          const remaining = conversations.filter(conv => conv.id !== conversationId)
          if (remaining.length > 0) {
            setActiveConversation(remaining[0].id)
            await loadConversationMessages(remaining[0].id)
          } else {
            await handleNewConversation()
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      // Still remove from local state even if API fails
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
    }
  }

  const handleRenameConversation = async (conversationId, newTitle) => {
    try {
      // Update in database
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secweb3_token')}`
        },
        body: JSON.stringify({ title: newTitle })
      })

      if (response.ok) {
        // Update local state
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: newTitle }
            : conv
        ))
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error)
      // Still update local state even if API fails
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: newTitle }
          : conv
      ))
    }
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
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
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
