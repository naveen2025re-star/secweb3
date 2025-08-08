// API configuration  
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Main contract analysis function
export const analyzeContract = async (code, filename = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        filename
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Server Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Analysis failed')
    }

    return data
  } catch (error) {
    console.error('API call failed:', error)

    // Re-throw the error so the frontend can handle it properly
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
    const response = await fetch(`${API_BASE_URL}/api/languages`)

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
    const response = await fetch(`${API_BASE_URL}/api/health`)

    if (!response.ok) {
      return { healthy: false, error: `Server returned ${response.status}` }
    }

    const data = await response.json()
    return { healthy: data.status === 'healthy', data }
  } catch (error) {
    return { healthy: false, error: error.message }
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
