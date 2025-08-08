import React, { useState, useRef } from 'react'
import { Send, Paperclip, Plus, Mic } from 'lucide-react'

const ChatInput = ({ onSendMessage, isAnalyzing, code, setCode }) => {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!message.trim() && !code.trim()) return
    if (isAnalyzing) return

    onSendMessage(message.trim() || 'Analyze this smart contract for security vulnerabilities', code)
    setMessage('')
    if (code) setCode('') // Clear code after sending
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCode(event.target.result)
      }
      reader.readAsText(file)
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  React.useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  return (
    <div className="border-t border-gray-600 bg-gray-800">
      <div className="max-w-3xl mx-auto p-4">
        {/* Code Preview */}
        {code && (
          <div className="mb-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Smart Contract Code Attached</span>
              <button
                onClick={() => setCode('')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-gray-400 font-mono bg-gray-900 p-2 rounded border border-gray-600 max-h-16 overflow-y-auto">
              {code.substring(0, 150)}
              {code.length > 150 && '...'}
            </div>
          </div>
        )}

        {/* Main Input */}
        <div className="relative">
          <div className="flex items-end space-x-3 bg-gray-700 rounded-xl border border-gray-600 p-3">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors rounded-lg hover:bg-gray-600"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".sol,.vy,.cairo,.move,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Text Input */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message SecWeb3..."
                disabled={isAnalyzing}
                className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '200px' }}
                rows="1"
              />
            </div>

            {/* Send Button */}
            {(message.trim() || code) && !isAnalyzing && (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-shrink-0 p-2 bg-white text-gray-800 rounded-lg hover:bg-gray-200 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            )}

            {/* Loading indicator */}
            {isAnalyzing && (
              <div className="flex-shrink-0 p-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Mic Button (when no text) */}
            {!message.trim() && !code && !isAnalyzing && (
              <button
                type="button"
                className="flex-shrink-0 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-600"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer text */}
        <div className="text-center mt-3">
          <p className="text-xs text-gray-500">
            SecWeb3 can make mistakes. Always verify security findings.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
