import React, { useState, useRef } from 'react'
import { Send, Paperclip, Mic, X, FileText, AlertCircle, Files, Code, ChevronDown } from 'lucide-react'
import FileSelector from './FileSelector'

const ChatInput = ({ onSendMessage, isAnalyzing, code, setCode }) => {
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [filename, setFilename] = useState('')
  const [inputMode, setInputMode] = useState('code') // 'code' or 'files'
  const [selectedFileIds, setSelectedFileIds] = useState([])
  const [showFileSelector, setShowFileSelector] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputMode === 'code') {
      if (!message.trim() && !code.trim()) return
    } else {
      if (!message.trim() && selectedFileIds.length === 0) return
    }
    if (isAnalyzing) return

    if (inputMode === 'files' && selectedFileIds.length > 0) {
      // Send with selected file IDs
      onSendMessage(
        message.trim() || 'Analyze the selected smart contract files for security vulnerabilities', 
        null, 
        selectedFileIds
      )
      setSelectedFileIds([])
    } else {
      // Send with direct code
      onSendMessage(message.trim() || 'Analyze this smart contract for security vulnerabilities', code)
      if (code) setCode('')
    }
    
    setMessage('')
    setFilename('')
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
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px'
    }
  }

  React.useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  const charCount = message.length
  const canSend = inputMode === 'code' 
    ? (message.trim() || code) && !isAnalyzing
    : (message.trim() || selectedFileIds.length > 0) && !isAnalyzing

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Mode Toggle */}
        <div className="mb-4 flex items-center justify-center">
          <div className="bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
            <button
              onClick={() => setInputMode('code')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                inputMode === 'code'
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Direct Code</span>
            </button>
            <button
              onClick={() => setInputMode('files')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                inputMode === 'files'
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Files className="w-4 h-4" />
              <span>Select Files</span>
            </button>
          </div>
        </div>

        {/* Selected Files Preview */}
        {inputMode === 'files' && selectedFileIds.length > 0 && (
          <div className="mb-4 bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-800/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Files className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white">
                    {selectedFileIds.length} Contract File{selectedFileIds.length !== 1 ? 's' : ''} Selected
                  </span>
                  <div className="text-xs text-gray-400">Ready for security analysis</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileIds([])}
                className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Code Preview */}
        {inputMode === 'code' && (code || filename) && (
          <div className="mb-4 bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-800/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white">
                    {filename || 'Smart Contract Attached'}
                  </span>
                  <div className="text-xs text-gray-400">{code.length.toLocaleString()} characters</div>
                </div>
              </div>
              <button
                onClick={() => { setCode(''); setFilename('') }}
                className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <pre className="text-xs text-gray-300 font-mono leading-relaxed">
                {code.substring(0, 400)}
                {code.length > 400 && '\n...'}
              </pre>
            </div>
          </div>
        )}

        {/* File Selector Panel */}
        {inputMode === 'files' && (
          <div className="mb-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-xl">
            <div className="p-4 border-b border-gray-700/50">
              <button
                onClick={() => setShowFileSelector(!showFileSelector)}
                className="w-full flex items-center justify-between text-left hover:bg-gray-700/30 p-3 rounded-lg transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Files className="w-5 h-5 text-blue-400" />
                  <div>
                    <span className="text-white font-medium">
                      {selectedFileIds.length > 0 
                        ? `${selectedFileIds.length} Files Selected` 
                        : 'Select Contract Files'
                      }
                    </span>
                    <div className="text-xs text-gray-400">
                      Choose from your uploaded contract files
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                  showFileSelector ? 'transform rotate-180' : ''
                }`} />
              </button>
            </div>
            
            {showFileSelector && (
              <div className="p-4">
                <FileSelector
                  selectedFileIds={selectedFileIds}
                  onFilesSelected={setSelectedFileIds}
                  onClose={() => setShowFileSelector(false)}
                  className="bg-gray-900/20 rounded-lg p-3"
                />
              </div>
            )}
          </div>
        )}

        {/* Main Input Container */}
        <div
          className={`relative transition-all duration-200 ${
            dragOver && inputMode === 'code'
              ? 'ring-2 ring-blue-400/50 ring-offset-0 ring-offset-gray-900' 
              : ''
          }`}
          onDragOver={inputMode === 'code' ? (e) => { e.preventDefault(); setDragOver(true) } : undefined}
          onDragLeave={inputMode === 'code' ? () => setDragOver(false) : undefined}
          onDrop={inputMode === 'code' ? onDrop : undefined}
        >
          <form onSubmit={handleSubmit} className="relative">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-xl">
              <div className="flex items-end p-4 gap-3">
                {/* Attachment Button */}
                {inputMode === 'code' && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="flex-shrink-0 w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 disabled:opacity-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                    title="Attach contract file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                )}
                {inputMode === 'files' && selectedFileIds.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFileSelector(true)}
                    className="w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                    title="Select files"
                  >
                    <Files className="w-4 h-4" />
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sol,.vy,.cairo,.move,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Text Input */}
                <div className="flex-1 min-h-0">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message SecWeb3..."
                    disabled={isAnalyzing}
                    className="w-full bg-transparent text-white placeholder-gray-500 resize-none border-0 focus:outline-none disabled:opacity-50 text-[15px] leading-6"
                    style={{ minHeight: '24px', maxHeight: '160px' }}
                    rows="1"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {message && !isAnalyzing && (
                    <button
                      type="button"
                      onClick={() => setMessage('')}
                      className="w-8 h-8 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                      title="Clear"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}

                  {!message.trim() && !code && !isAnalyzing && (
                    <button
                      type="button"
                      className="w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                      title="Voice input (coming soon)"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!canSend}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      canSend
                        ? 'bg-white hover:bg-gray-100 text-gray-900 shadow-lg hover:shadow-xl'
                        : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    {isAnalyzing ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Info Bar */}
              <div className="flex items-center justify-between px-4 pb-3 text-xs">
                <div className="flex items-center space-x-3 text-gray-500">
                  <span>⌘↵ to send</span>
                  <span>•</span>
                  <span>Drag & drop files</span>
                </div>
                <span className="text-gray-500">{charCount}/4000</span>
              </div>
            </div>
          </form>

          {/* Drag Overlay */}
          {dragOver && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-blue-300 font-medium">Drop your smart contract file here</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center mt-4 text-center">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <AlertCircle className="w-3 h-3" />
            <span>SecWeb3 can make mistakes. Always verify security findings.</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
