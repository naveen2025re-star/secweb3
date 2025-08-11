// API configuration
const SHIPABLE_API_BASE = 'https://api.shipable.ai/v2'
const SHIPABLE_JWT_TOKEN = import.meta.env.VITE_SHIPABLE_JWT_TOKEN
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('secweb3_token')
}

// Create authenticated headers
const getAuthHeaders = () => {
  const token = getAuthToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Main contract analysis function - directly calls Shipable API
export const analyzeContract = async (code, filename = null) => {
  try {
    // Step 1: Create session with Shipable API
    console.log('🔄 Creating Shipable session...')

    const sessionResponse = await fetch(`${SHIPABLE_API_BASE}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SHIPABLE_JWT_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        source: "website"
      })
    })

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text()
      console.error('❌ Shipable session creation failed:', errorText)
      throw new Error(`Failed to create Shipable session: ${sessionResponse.status} - ${errorText}`)
    }

    const sessionData = await sessionResponse.json()
    console.log('✅ Shipable session created:', sessionData)

    if (!sessionData || sessionData.statusCode !== 201 || !sessionData.data?.key) {
      throw new Error(`Invalid session response from Shipable API: ${JSON.stringify(sessionData)}`)
    }

    return {
      success: true,
      sessionKey: sessionData.data.key,
      metadata: {
        language: detectContractLanguage(code, filename),
        filename: filename || null,
        lineCount: code ? code.split('\n').length : 0,
        timestamp: new Date().toISOString(),
        shipableSessionId: sessionData.data.id
      }
    }
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}

// Direct streaming analysis function
export const streamAnalysis = async (sessionKey, message, code) => {
  try {
    console.log('🔄 Starting Shipable streaming analysis...')

    // Prepare the request data in the format expected by Shipable API
    const requestData = {
      sessionKey: sessionKey,
      messages: [
        {
          role: "user",
          content: code ? `${message}\n\nContract Code:\n${code}` : message
        }
      ],
      token: SHIPABLE_JWT_TOKEN,
      stream: true
    }

    // Create multipart form data
    const formData = new FormData()
    formData.append('request', JSON.stringify(requestData))

    console.log('🔄 Sending request data:', requestData)

    const response = await fetch(`${SHIPABLE_API_BASE}/chat/open-playground`, {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
        // Note: Don't set Content-Type for FormData - browser will set it automatically with boundary
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Shipable streaming failed:', errorText)
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

// Save conversation
export const saveConversation = async (conversation) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(conversation)
    })

    if (!response.ok) {
      throw new Error(`Failed to save conversation: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to save conversation:', error)
    // Don't throw error to avoid breaking the app
    return { success: false, error: error.message }
  }
}

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
