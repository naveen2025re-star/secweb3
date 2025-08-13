import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

const ChatInterface = ({ messages, isAnalyzing, streamingMessage, onShowPlans }) => {
  const messagesEndRef = useRef(null)
  const [copiedMessageId, setCopiedMessageId] = useState(null)

  // Optimized scroll function with RAF
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: "smooth",
          block: "end",
          inline: "nearest"
        })
      })
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Throttled scroll for streaming to prevent excessive calls
  const debouncedStreamingScroll = useMemo(() => {
    let timeoutId
    return () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 50) // Reduced delay for better responsiveness
    }
  }, [scrollToBottom])

  useEffect(() => {
    if (streamingMessage) {
      debouncedStreamingScroll()
    }
  }, [streamingMessage, debouncedStreamingScroll])

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(id)
      setTimeout(() => setCopiedMessageId(null), 1200)
    } catch (e) {
      // No-op: clipboard may be blocked
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
    <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          {messages.length === 0 && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <h2 className="text-2xl font-semibold text-white mb-2">
                SecWeb3
              </h2>
              <p className="text-gray-400 max-w-md">
                How can I help you secure your smart contract today?
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`group px-3 sm:px-6 lg:px-4 animate-fade-in ${message.type === 'user' ? 'bg-gradient-to-r from-blue-900/20 to-blue-800/20' : 'bg-gradient-to-r from-gray-700/30 to-gray-800/30'}`}>
              <div className="max-w-4xl mx-auto py-4 sm:py-6">
                <div className="flex space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0">
                    {message.type === 'user' ? (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        You
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        AI
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100">
                      {message.type === 'user' ? (
                        <div className="space-y-4">
                          <p className="text-base leading-relaxed whitespace-pre-wrap break-words-safe">{message.content}</p>
                          {message.code && (
                            <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                              <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Smart Contract Code</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                  <span className="text-xs text-gray-500">{message.code.length} chars</span>
                                </div>
                              </div>
                              <div className="p-4 overflow-x-auto">
                                <pre className="text-sm text-gray-200 font-mono break-words-safe whitespace-pre-wrap">
                                  <code>{message.code.length > 500 ? message.code.substring(0, 500) + '...\n\n/* Code truncated for display */' : message.code}</code>
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <MarkdownRenderer 
                            content={message.content} 
                            streaming={message.streaming} 
                          />
                          {/* Upgrade button for credit errors */}
                          {message.showUpgradeButton && onShowPlans && (
                            <div className="mt-6 pt-4 border-t border-gray-600/50">
                              <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="text-white font-semibold mb-1">Need More Credits?</h4>
                                    <p className="text-gray-300 text-sm">Upgrade to continue your security analysis</p>
                                  </div>
                                  <button
                                    onClick={onShowPlans}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
                                  >
                                    <span>⚡</span>
                                    <span>Upgrade Now</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Copy button */}
                          <button
                            className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-gray-800/50"
                            title={copiedMessageId === message.id ? 'Copied!' : 'Copy message'}
                            aria-label="Copy response"
                            onClick={() => handleCopy(message.id, message.content)}
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Advanced Streaming Message with Zero Flicker */}
          {isAnalyzing && (
            <div className="group px-4 bg-gradient-to-r from-gray-700/80 via-gray-700/95 to-gray-700/80 backdrop-blur-sm will-change-transform">
              <div className="max-w-3xl mx-auto py-6">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0">
                    <div className="relative w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg will-change-transform">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg opacity-0 animate-pulse-subtle-glow"></div>
                      <span className="relative z-10">AI</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100 will-change-contents">
                      <div className="min-h-[2rem] transition-all duration-200 ease-out">
                        {streamingMessage ? (
                          <div className="transform-gpu will-change-transform">
                            <div className="opacity-100 transition-opacity duration-200">
                              <MarkdownRenderer 
                                content={streamingMessage} 
                                streaming={true} 
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3 py-2 min-h-[2rem]">
                            <div className="flex space-x-1.5 items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 animate-streaming-dot" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 animate-streaming-dot" style={{ animationDelay: '160ms' }}></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 animate-streaming-dot" style={{ animationDelay: '320ms' }}></div>
                            </div>
                            <div className="text-sm text-gray-300 font-medium animate-pulse-text">Analyzing your code...</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
