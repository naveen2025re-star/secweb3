import React, { useState, useRef } from 'react'
import { Send, Paperclip, Mic, X, FileText } from 'lucide-react'

const ChatInput = ({ onSendMessage, isAnalyzing, code, setCode }) => {
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [filename, setFilename] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!message.trim() && !code.trim()) return
    if (isAnalyzing) return

    onSendMessage(message.trim() || 'Analyze this smart contract for security vulnerabilities', code)
    setMessage('')
    setFilename('')
    if (code) setCode('') // Clear code after sending
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setCode(event.target.result || '')
      setFilename(file.name || '')
    }
    reader.readAsText(file)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
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

  const charCount = message.length

  return (
    <div
      className={`border-t border-gray-700 bg-gray-800 ${dragOver ? 'ring-2 ring-blue-500 ring-offset-0' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="max-w-3xl mx-auto p-4">
        {/* Code Preview */}
        {(code || filename) && (
          <div className="mb-3 p-3 bg-gray-700/80 rounded-lg border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300 inline-flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                {filename ? filename : 'Smart Contract Code Attached'}
              </span>
              <button
                onClick={() => { setCode(''); setFilename('') }}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Remove attached code"
                title="Remove attached code"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-gray-300 font-mono bg-gray-900 p-2 rounded border border-gray-600 max-h-24 overflow-y-auto">
              {code.substring(0, 300)}
              {code.length > 300 && '...'}
            </div>
          </div>
        )}

        {/* Main Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end space-x-3 bg-gray-700 rounded-xl border border-gray-600 p-3">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-white disabled:opacity-50 transition-colors rounded-lg hover:bg-gray-600"
              title="Attach smart contract file (.sol, .vy, .move, .cairo)"
              aria-label="Attach file"
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
                placeholder="Message SecWeb3... (Shift+Enter for newline)"
                disabled={isAnalyzing}
                className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '200px' }}
                rows="1"
                aria-label="Message input"
              />
            </div>

            {/* Clear text button */}
            {message && !isAnalyzing && (
              <button
                type="button"
                onClick={() => setMessage('')}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-600 transition-colors"
                aria-label="Clear message"
                title="Clear message"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!message.trim() && !code) || isAnalyzing}
              className="flex-shrink-0 p-2 bg-white text-gray-800 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Send"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Loading indicator */}
            {isAnalyzing && (
              <div className="flex-shrink-0 p-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Mic Button (when idle) */}
            {!message.trim() && !code && !isAnalyzing && (
              <button
                type="button"
                className="flex-shrink-0 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-600"
                aria-label="Voice input (coming soon)"
                title="Voice input (coming soon)"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Helper row */}
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>Shift+Enter for newline • Drag & drop a .sol/.vy/.move/.cairo file to attach</span>
            <span>{charCount.toLocaleString()} chars</span>
          </div>
        </form>

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
