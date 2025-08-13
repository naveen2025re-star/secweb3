import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { Copy, Check, Sparkles, Code, Shield, Zap, Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

const ChatInterface = ({ messages, isAnalyzing, streamingMessage, onShowPlans }) => {
  const messagesEndRef = useRef(null)
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [visibleMessages, setVisibleMessages] = useState(new Set())

  // Smart scroll with anti-flicker optimization
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      // Use native scrollIntoView with instant behavior to prevent flicker
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end' 
      })
    }
  }, [])

  // Optimized effect for message changes
  useEffect(() => {
    // Small delay to allow DOM updates to complete before scrolling
    const timeoutId = setTimeout(scrollToBottom, 10)
    return () => clearTimeout(timeoutId)
  }, [messages.length, scrollToBottom])

  // Streaming message effect with flicker prevention
  useEffect(() => {
    if (streamingMessage) {
      // Debounced scroll for streaming to prevent excessive calls
      const timeoutId = setTimeout(scrollToBottom, 50)
      return () => clearTimeout(timeoutId)
    }
  }, [streamingMessage, scrollToBottom])

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(id)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (e) {
      console.warn('Copy failed:', e)
    }
  }

  // Optimized markdown renderer with flicker prevention
  const MarkdownRenderer = React.memo(({ content, streaming = false }) => {
    if (!content && !streaming) return null

    return (
      <div className="markdown-content prose prose-invert max-w-none break-words will-change-contents transform-gpu">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({children}) => (
              <h1 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-gray-700 pb-2">
                {children}
              </h1>
            ),
            h2: ({children}) => (
              <h2 className="text-xl font-semibold text-white mt-6 mb-3">
                {children}
              </h2>
            ),
            h3: ({children}) => (
              <h3 className="text-lg font-medium text-white mt-4 mb-2">
                {children}
              </h3>
            ),
            h4: ({children}) => (
              <h4 className="text-base font-medium text-gray-200 mt-3 mb-2">
                {children}
              </h4>
            ),
            p: ({children}) => (
              <p className="text-gray-200 leading-relaxed mb-4 text-[15px]">
                {children}
              </p>
            ),
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '')

              if (!inline && match) {
                return (
                  <div className="my-4 bg-gray-950 rounded-xl overflow-hidden border border-gray-800">
                    <div className="bg-gray-900 px-4 py-2 text-xs text-gray-400 border-b border-gray-800 font-medium">
                      {match[1].toUpperCase()}
                    </div>
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      className="!mt-0 !mb-0 text-sm !bg-gray-950"
                      customStyle={{
                        background: 'transparent',
                        padding: '1rem'
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                )
              }

              return (
                <code className="bg-gray-800 text-emerald-400 px-2 py-1 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              )
            },
            ul: ({children}) => (
              <ul className="space-y-2 mb-4 ml-6 list-disc marker:text-gray-500">
                {children}
              </ul>
            ),
            ol: ({children}) => (
              <ol className="space-y-2 mb-4 ml-6 list-decimal marker:text-gray-500">
                {children}
              </ol>
            ),
            li: ({children}) => (
              <li className="text-gray-200 text-[15px] leading-relaxed">
                {children}
              </li>
            ),
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-blue-500 pl-6 py-3 my-4 bg-gray-800/30 rounded-r-lg">
                <div className="text-gray-300 italic">
                  {children}
                </div>
              </blockquote>
            ),
            strong: ({children}) => (
              <strong className="font-semibold text-white">
                {children}
              </strong>
            ),
            em: ({children}) => (
              <em className="italic text-gray-300">
                {children}
              </em>
            ),
            table: ({children}) => (
              <div className="my-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700 rounded-lg overflow-hidden">
                  {children}
                </table>
              </div>
            ),
            thead: ({children}) => (
              <thead className="bg-gray-800">
                {children}
              </thead>
            ),
            tbody: ({children}) => (
              <tbody className="bg-gray-900/50 divide-y divide-gray-700">
                {children}
              </tbody>
            ),
            tr: ({children}) => (
              <tr className="hover:bg-gray-800/50">
                {children}
              </tr>
            ),
            th: ({children}) => (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                {children}
              </th>
            ),
            td: ({children}) => (
              <td className="px-4 py-3 text-sm text-gray-200">
                {children}
              </td>
            ),
            hr: () => (
              <hr className="my-6 border-gray-700" />
            )
          }}
        >
          {content}
        </ReactMarkdown>

        {streaming && (
          <div className="flex items-center space-x-2 mt-4">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            <span className="text-xs text-gray-400 ml-2">Analyzing...</span>
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 relative">
      {/* Animated background patterns */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-emerald-500 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll scroll-smooth relative z-10">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* Welcome State */}
          {messages.length === 0 && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="relative mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full animate-ping"></div>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mb-4">
                SecWeb3 AI Security Auditor
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
                Upload your smart contract and get comprehensive security analysis powered by advanced AI. 
                Supports Solidity, Vyper, Move, and Cairo.
              </p>
              <div className="flex items-center space-x-4 mt-8 text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <Code className="w-4 h-4 text-blue-400" />
                  <span>Multi-language</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Lightning fast</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Enterprise grade</span>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div 
              key={message.id || index}
              className={`group relative animate-fade-in-up transform transition-all duration-500 hover:scale-[1.02] ${
                message.type === 'user' ? 'ml-8' : 'mr-8'
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Message Container */}
              <div className={`relative rounded-3xl p-6 shadow-2xl backdrop-blur-sm border transition-all duration-300 ${
                message.type === 'user' 
                  ? 'bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20 hover:border-blue-400/40' 
                  : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/30 hover:border-gray-600/50'
              }`}>
                {/* Avatar and Header */}
                <div className="flex items-start space-x-4">
                  <div className="relative flex-shrink-0">
                    {message.type === 'user' ? (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-blue-400/20">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-emerald-400/20">
                        <Bot className="w-6 h-6 text-white" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse">
                          <div className="w-full h-full bg-emerald-400 rounded-full animate-ping"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 min-w-0">
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-semibold ${
                          message.type === 'user' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {message.type === 'user' ? 'You' : 'SecWeb3 AI'}
                        </span>
                        {message.type !== 'user' && (
                          <div className="flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                            <span className="text-xs text-gray-500">AI-powered analysis</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Copy Button - Enhanced */}
                      <button
                        className={`p-2 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                          copiedMessageId === message.id 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'hover:bg-gray-700/50 text-gray-400 hover:text-white'
                        }`}
                        title={copiedMessageId === message.id ? 'Copied!' : 'Copy message'}
                        onClick={() => handleCopy(message.id, message.content)}
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Message Content */}
                    <div className="text-gray-100">
                      {message.type === 'user' ? (
                        <div className="space-y-4">
                          <p className="text-base leading-relaxed whitespace-pre-wrap text-gray-200">
                            {message.content}
                          </p>
                          {message.code && (
                            <div className="bg-gradient-to-br from-gray-950 to-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden shadow-xl">
                              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-4 py-3 border-b border-gray-600/50 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Code className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm font-medium text-gray-300">Smart Contract Code</span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-gray-400">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                  <span>{message.code.length} chars</span>
                                </div>
                              </div>
                              <div className="p-4">
                                <pre className="text-sm text-gray-200 font-mono overflow-x-auto">
                                  <code>{message.code.length > 500 
                                    ? `${message.code.substring(0, 500)}...\n\n/* Code truncated for display */` 
                                    : message.code
                                  }</code>
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="prose prose-invert prose-lg max-w-none">
                            <MarkdownRenderer 
                              content={message.content} 
                              streaming={message.streaming} 
                            />
                          </div>
                          
                          {/* Upgrade CTA */}
                          {message.showUpgradeButton && onShowPlans && (
                            <div className="mt-6 p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-2xl backdrop-blur-sm">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-white font-semibold mb-1 flex items-center space-x-2">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    <span>Need More Credits?</span>
                                  </h4>
                                  <p className="text-gray-300 text-sm">Upgrade to continue your security analysis</p>
                                </div>
                                <button
                                  onClick={onShowPlans}
                                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
                                >
                                  <Sparkles className="w-4 h-4" />
                                  <span>Upgrade Now</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Premium AI Streaming Interface - Zero Flicker Design */}
          {isAnalyzing && (
            <div className="relative animate-fade-in-up transform transition-all duration-500 mr-8">
              {/* Streaming Message Container */}
              <div className="relative rounded-3xl p-6 shadow-2xl backdrop-blur-sm border bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700/30 hover:border-gray-600/50 transition-all duration-300">
                {/* AI Header */}
                <div className="flex items-start space-x-4">
                  {/* Enhanced AI Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-emerald-400/20 relative overflow-hidden">
                      {/* Animated background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/30 to-green-400/30 animate-pulse"></div>
                      {/* Rotating border effect */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-emerald-300/20 animate-spin-slow"></div>
                      <Bot className="w-6 h-6 text-white relative z-10" />
                      
                      {/* Active indicator */}
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse">
                        <div className="w-full h-full bg-emerald-400 rounded-full animate-ping"></div>
                      </div>
                    </div>
                  </div>

                  {/* Content Area with Anti-Flicker Technology */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-emerald-400">SecWeb3 AI</span>
                        <div className="flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                          <span className="text-xs text-gray-500">Analyzing</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-400">Active</span>
                      </div>
                    </div>

                    {/* Stable Content Container - Key for flicker prevention */}
                    <div className="relative min-h-[4rem] bg-gradient-to-br from-gray-900/30 to-gray-800/30 rounded-2xl p-4 border border-gray-700/20">
                      {/* Streaming content with fade transition */}
                      <div className="transition-opacity duration-300" style={{ opacity: streamingMessage ? 1 : 0.7 }}>
                        {streamingMessage ? (
                          <div className="prose prose-invert prose-lg max-w-none animate-fade-in">
                            <MarkdownRenderer 
                              content={streamingMessage} 
                              streaming={true} 
                            />
                            {/* Live typing indicator */}
                            <div className="flex items-center space-x-2 mt-4 text-gray-400">
                              <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '160ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '320ms' }}></div>
                              </div>
                              <span className="text-xs">AI is processing...</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            {/* Premium loading animation */}
                            <div className="flex flex-col items-center space-y-4">
                              <div className="relative">
                                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
                                <div className="absolute inset-2 w-12 h-12 border-2 border-purple-500/20 border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                              </div>
                              <div className="text-center">
                                <div className="text-emerald-400 font-semibold text-base mb-1">Analyzing Smart Contract</div>
                                <div className="text-gray-400 text-sm">Advanced AI security analysis in progress...</div>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <Shield className="w-3 h-3 text-emerald-400" />
                                  <span>Security scan</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Code className="w-3 h-3 text-blue-400" />
                                  <span>Code analysis</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Zap className="w-3 h-3 text-purple-400" />
                                  <span>AI insights</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
