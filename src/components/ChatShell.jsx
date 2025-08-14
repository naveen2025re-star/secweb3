import React, { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import Sidebar from './Sidebar'
import ChatInterface from './ChatInterface'
import ChatInput from './ChatInput'
import Header from './Header'
import {
    checkBackendHealth, analyzeContract, streamAnalysis, getUserConversations, createConversation,
    addMessageToConversation
} from '../utils/api'

/**
 * ChatShell renders the authenticated chat experience.
 * It holds all chat-related hooks and state so that App.jsx doesn't call hooks conditionally.
 */
const ChatShell = ({ user, onShowPlans, onDisconnect }) => {
  const [darkMode, setDarkMode] = useState(false);
  const [code, setCode] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamingMessage, setStreamingMessage] = useState('')
  const [backendHealth, setBackendHealth] = useState({ healthy: false, checking: true })
  const [loadingConversations, setLoadingConversations] = useState(true)

  // Conversation management
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)

  // Credit management
  const [userPlan, setUserPlan] = useState(null)
  const [creditsBalance, setCreditsBalance] = useState(user?.creditsBalance || 0)
  const [creditsHistory, setCreditsHistory] = useState([])
  const [showCreditsNotification, setShowCreditsNotification] = useState(false)

  // Load user plan and credits
  const loadUserPlan = async () => {
    try {
      const response = await fetch('/api/plans/current', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('secweb3_token')}`
        }
      });

      if (response.ok) {
        const planData = await response.json();
        setUserPlan(planData.plan);
        setCreditsBalance(planData.creditsBalance);
      } else {
        console.warn('Failed to load user plan:', response.status);
      }
    } catch (error) {
      console.warn('Failed to load user plan:', error);
    }
  };

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
    loadUserPlan()

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
    if (!(message || '').trim() && !(contractCode || '').trim()) return
    if (analyzing) return

    setAnalyzing(true)
    setStreamingMessage('')

    // Create unique loading message ID
    const loadingMessageId = `loading_${Date.now()}`

    // Show immediate feedback
    const loadingMessage = {
      id: loadingMessageId,
      type: 'ai',
      content: '🔍 **Initializing scan and deducting credits...**\n\nPlease wait while we prepare your analysis.',
      timestamp: new Date().toLocaleTimeString(),
      streaming: true
    }
    setMessages(prev => [...prev, loadingMessage])

    // Create conversation if none exists
    let conversationId = activeConversation
    if (!conversationId) {
      conversationId = await handleNewConversation()
    }

    // Add user message immediately
    const userMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      code: contractCode
    }
    setMessages(prev => [...prev, userMessage])

    // Save user message to database with error handling
    if (conversationId && !String(conversationId).startsWith('local_')) {
      try {
        await addMessageToConversation(
          conversationId, 
          'user', 
          message, 
          { code: contractCode }
        )
      } catch (error) {
        console.error('Failed to save user message:', error)
        // Continue without blocking the analysis
      }
    }

    try {
      // Step 1: Create session (with credit deduction)
      // For chat messages, send the message content; for contracts, send the contract code
      const contentToAnalyze = (contractCode || '').trim() ? contractCode : message
      const sessionData = await analyzeContract(contentToAnalyze, contractCode ? 'contract.sol' : undefined)

      if (!sessionData.success) {
        // Remove loading message first
        setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId))

        // Handle credit-related errors with upgrade button
        if (sessionData.creditError) {
          let errorMsg = `❌ **${sessionData.error.includes('Insufficient') ? 'Insufficient Credits' : 'Scan Limit Exceeded'}**\n\n${sessionData.error}`;

          if (sessionData.scanCost && sessionData.availableCredits !== undefined) {
            errorMsg += `\n\n**💳 Scan Cost:** ${sessionData.scanCost} credits\n**💰 Available:** ${sessionData.availableCredits} credits`;
          }

          errorMsg += `\n\n*Upgrade your plan to get more credits and higher scan limits.*`;

          const errorMessage = {
            id: `error_${Date.now()}`,
            type: 'ai',
            content: errorMsg,
            timestamp: new Date().toLocaleTimeString(),
            error: true,
            showUpgradeButton: true
          };
          setMessages(prev => [...prev, errorMessage]);
          return;
        }

        throw new Error(sessionData.error || 'Failed to create analysis session');
      }

      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId))

      // Update credits balance if provided
      if (sessionData.creditInfo) {
        const newBalance = sessionData.creditInfo.creditsRemaining;
        const deducted = sessionData.creditInfo.creditsDeducted;
        
        setCreditsBalance(newBalance);
        console.log(`💳 Credits deducted: ${deducted}, Remaining: ${newBalance}`);

        // Add to credits history
        if (deducted > 0) {
          const historyEntry = {
            id: Date.now(),
            type: 'deduction',
            amount: deducted,
            reason: (contractCode || '').trim() ? 'Contract Analysis' : 'AI Chat',
            timestamp: new Date().toISOString(),
            remainingBalance: newBalance
          };
          setCreditsHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 entries

          // Show visual notification
          setShowCreditsNotification(true);
          setTimeout(() => setShowCreditsNotification(false), 3000);
        }

        // Also update the user plan in parent component if needed
        if (typeof onCreditUpdate === 'function') {
          onCreditUpdate(newBalance);
        }
      }

      // Step 2: Start streaming
      const streamResponse = await streamAnalysis(sessionData.sessionKey, message, contractCode)

      if (!streamResponse.body) {
        throw new Error('No response body received')
      }

      // Step 3: Handle streaming with throttled updates
      const reader = streamResponse.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let lastUpdateTime = 0
      const UPDATE_THROTTLE = 300 // Update every 300ms max

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

                const aiMessage = {
                  id: `ai_${Date.now()}`,
                  type: 'ai',
                  content: fullContent,
                  timestamp: new Date().toLocaleTimeString()
                }
                setMessages(prev => [...prev, aiMessage])

                // Save final message
                if (conversationId && !String(conversationId).startsWith('local_')) {
                  try {
                    await addMessageToConversation(
                      conversationId,
                      'assistant',
                      fullContent,
                      { sessionKey: sessionData.sessionKey }
                    )
                  } catch (error) {
                    console.error('Failed to save AI message:', error)
                  }
                }
                return
              }

              if (data && data !== '') {
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.body) {
                    fullContent += parsed.body

                    // Throttled UI updates to prevent flickering
                    const now = Date.now()
                    if (now - lastUpdateTime > UPDATE_THROTTLE) {
                      setStreamingMessage(fullContent)
                      lastUpdateTime = now
                    }
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        // Stream ended without [DONE]
        setAnalyzing(false)
        setStreamingMessage('')

        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: fullContent,
          timestamp: new Date().toLocaleTimeString()
        }
        setMessages(prev => [...prev, aiMessage])

      } catch (streamError) {
        throw streamError
      } finally {
        try { reader.releaseLock() } catch {}
      }

    } catch (error) {
      setAnalyzing(false)
      setStreamingMessage('')

      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId))

      const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        content: `❌ **Analysis Failed**\n\n${error.message}\n\nPlease try again.`,
        timestamp: new Date().toLocaleTimeString(),
        error: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      // Ensure cleanup happens regardless
      setAnalyzing(false)
      setStreamingMessage('')
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
    <div className={`h-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
      {/* Credits Notification */}
      {showCreditsNotification && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg border-l-4 border-blue-300">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Credits Updated</span>
            </div>
            <div className="text-xs opacity-90 mt-1">
              Current balance: {creditsBalance} credits
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        user={{
          ...user,
          creditsBalance,
          plan: userPlan,
          creditsHistory
        }}
        onShowPlans={onShowPlans}
        onDisconnect={onDisconnect}
      />

      {/* Main Content */}
      <div className="flex-1 flex bg-gray-800">
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
            onShowPlans={onShowPlans}
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
    </div>
  )
}

export default ChatShell
