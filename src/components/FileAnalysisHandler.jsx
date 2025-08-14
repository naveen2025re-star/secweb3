import React from 'react'

/**
 * Robust file analysis handler that eliminates null/trim errors
 * and handles file content properly
 */
class FileAnalysisHandler {
  static safeTrim(value) {
    return (value || '').toString().trim()
  }

  static validateInput(message, code, selectedFileIds) {
    const safeMessage = this.safeTrim(message)
    const safeCode = this.safeTrim(code)
    const safeFileIds = Array.isArray(selectedFileIds) ? selectedFileIds : []

    return {
      message: safeMessage,
      code: safeCode,
      selectedFileIds: safeFileIds,
      hasMessage: safeMessage.length > 0,
      hasCode: safeCode.length > 0,
      hasFiles: safeFileIds.length > 0,
      isValid: safeMessage.length > 0 || safeCode.length > 0 || safeFileIds.length > 0
    }
  }

  static async analyzeFiles(input) {
    try {
      const token = localStorage.getItem('secweb3_token')
      if (!token) {
        throw new Error('Authentication token not found')
      }

      const payload = {
        message: input.message || '',
        code: input.code || '',
        selectedFileIds: input.selectedFileIds || []
      }

      console.log('🔄 Sending file analysis request:', {
        hasMessage: !!payload.message,
        hasCode: !!payload.code,
        fileCount: payload.selectedFileIds.length,
        payload
      })

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ File analysis failed:', error)
      throw error
    }
  }

  static generateDefaultMessage(fileCount) {
    if (fileCount === 0) {
      return 'Analyze this smart contract for security vulnerabilities'
    }
    return `Analyze ${fileCount} selected smart contract file${fileCount > 1 ? 's' : ''} for security vulnerabilities`
  }
}

export default FileAnalysisHandler
