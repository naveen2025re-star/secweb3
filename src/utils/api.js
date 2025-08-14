// API configuration
const SHIPABLE_API_BASE = 'https://api.shipable.ai/v2'
const SHIPABLE_JWT_TOKEN = import.meta.env.VITE_SHIPABLE_JWT_TOKEN
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

// Get auth token from localStorage
const getAuthToken = () => {
  // Try both possible token keys for compatibility
  return localStorage.getItem('secweb3_token') || localStorage.getItem('auth_token')
}

// Create authenticated headers
const getAuthHeaders = () => {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Main contract analysis function - calls backend with credit deduction
export const analyzeContract = async (code, filename = 'contract.sol', selectedFileIds = null) => {
  try {
    console.log('🔄 Starting contract analysis...')

    // Use open playground endpoint for file analysis, regular analyze endpoint for direct code
    const endpoint = selectedFileIds && selectedFileIds.length > 0 
      ? '/api/open-playground' 
      : '/api/analyze';

    console.log(`📍 Using endpoint: ${endpoint} for ${selectedFileIds?.length ? 'file analysis' : 'code analysis'}`);

    const payload = selectedFileIds && selectedFileIds.length > 0
      ? { 
          message: `Analyze ${selectedFileIds.length} selected smart contract file${selectedFileIds.length > 1 ? 's' : ''} for security vulnerabilities`,
          selectedFileIds 
        }
      : { code, filename };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok && response.status >= 500) {
      throw new Error('Server is temporarily unavailable. Please try again in a moment.')
    }

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      throw new Error('Invalid response from server. Please try again.')
    }

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Authentication required. Please sign in again.')
      }

      if (response.status === 402 || response.status === 403) {
        // Credit-related errors - return detailed info for UI
        return {
          success: false,
          error: data.error,
          scanCost: data.scanCost,
          availableCredits: data.availableCredits,
          planName: data.planName,
          creditError: true
        }
      }

      if (response.status === 503) {
        throw new Error(data.error || 'Analysis service temporarily unavailable')
      }

      throw new Error(data.error || `Analysis failed: ${response.status}`)
    }

    if (!data.success) {
      throw new Error(data.error || 'Analysis session creation failed')
    }

    console.log('✅ Analysis session created with credit deduction:', data.creditInfo)

    return {
      success: true,
      sessionKey: data.sessionKey,
      creditInfo: data.creditInfo,
      metadata: data.metadata
    }
  } catch (error) {
    console.error('Analysis failed:', error)
    throw error
  }
}

// Direct streaming analysis function - uses backend streaming endpoint
export const streamAnalysis = async (sessionKey, message, code) => {
  try {
    console.log('🔄 Starting streaming analysis via backend...')

    // Call the backend streaming endpoint which handles Shipable API integration
    const response = await fetch(`${API_BASE_URL}/api/analyze/stream/${sessionKey}`, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        message,
        code
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Backend streaming failed:', errorText)
      throw new Error(`Analysis streaming failed: ${response.status} - ${errorText}`)
    }

    return response
  } catch (error) {
    console.error('Streaming analysis failed:', error)
    throw error
  }
}

// File upload function
export const uploadContractFile = async (file) => {
  try {
    const formData = new FormData()
    formData.append('contract', file)

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Upload Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'File upload failed')
    }

    return data
  } catch (error) {
    console.error('File upload failed:', error)
    throw error
  }
}

// Get supported languages
export const getSupportedLanguages = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/languages`, {
      headers: {
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch languages: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get supported languages:', error)

    // Return default languages if API fails
    return {
      supported: [
        { name: 'Solidity', extension: '.sol', description: 'Ethereum smart contracts' },
        { name: 'Vyper', extension: '.vy', description: 'Python-like contracts' },
        { name: 'Move', extension: '.move', description: 'Aptos/Sui contracts' },
        { name: 'Cairo', extension: '.cairo', description: 'StarkNet contracts' }
      ]
    }
  }
}

// Health check function
export const checkBackendHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      headers: {
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      return { healthy: false, error: `Server returned ${response.status}` }
    }

    const data = await response.json()
    return { healthy: data.status === 'healthy', data }
  } catch (error) {
    return { healthy: false, error: error.message }
  }
}

// User profile functions
export const getUserProfile = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get user profile:', error)
    throw error
  }
}

export const updateUserProfile = async (displayName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ displayName })
    })

    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to update profile:', error)
    throw error
  }
}

// Conversation API functions

// Get user conversations
export const getUserConversations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get conversations: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get conversations:', error)
    // Return empty array to avoid breaking the app
    return { success: false, conversations: [] }
  }
}

// Create new conversation
export const createConversation = async (title, messages = []) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ title, messages })
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return { success: false, error: error.message }
  }
}

// Get conversation with messages
export const getConversation = async (conversationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get conversation:', error)
    return { success: false, error: error.message }
  }
}

// Add message to conversation
export const addMessageToConversation = async (conversationId, role, content, metadata = {}) => {
  try {
    // Skip API calls for local conversations
    if (String(conversationId).startsWith('local_')) {
      return { 
        success: true, 
        message: { 
          id: Date.now(), 
          role, 
          content, 
          metadata,
          created_at: new Date().toISOString()
        } 
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ role, content, metadata: metadata || {} })
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to save message (${response.status}): ${errorText}`);
      // Return success to prevent blocking the UI flow
      return { 
        success: true, 
        message: { id: Date.now(), role, content, metadata } 
      };
    }

    return await response.json()
  } catch (error) {
    console.warn('Message save failed (non-blocking):', error.message);
    // Always return success to prevent blocking the chat flow
    return { 
      success: true, 
      message: { id: Date.now(), role, content, metadata } 
    };
  }
}

// Update conversation title
export const updateConversationTitle = async (conversationId, title) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ title })
    })

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to update conversation:', error)
    return { success: false, error: error.message }
  }
}

// Delete conversation
export const deleteConversation = async (conversationId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return { success: false, error: error.message }
  }
}

// Utility functions
export const detectContractLanguage = (code, filename) => {
  if (filename) {
    if (filename.endsWith('.sol')) return 'Solidity'
    if (filename.endsWith('.vy')) return 'Vyper'
    if (filename.endsWith('.move')) return 'Move'
    if (filename.endsWith('.cairo')) return 'Cairo'
  }

  const lowerCode = code.toLowerCase()
  if (lowerCode.includes('pragma solidity') || lowerCode.includes('contract ')) return 'Solidity'
  if (lowerCode.includes('# @version') || lowerCode.includes('@external')) return 'Vyper'
  if (lowerCode.includes('module ') && lowerCode.includes('fun ')) return 'Move'
  if (lowerCode.includes('#[contract]') || lowerCode.includes('func ')) return 'Cairo'

  return 'Unknown'
}

export const validateContractCode = (code) => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Contract code is required' }
  }

  if (code.trim().length < 10) {
    return { valid: false, error: 'Contract code is too short to analyze' }
  }

  if (code.length > 500000) {
    return { valid: false, error: 'Contract code is too large (max 500KB)' }
  }

  return { valid: true }
}
