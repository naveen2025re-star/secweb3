import React, { useEffect, useRef, useMemo } from 'react'
import { Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import SecurityAuditResults from './SecurityAuditResults'

const ChatInterface = ({ messages, isAnalyzing, streamingMessage }) => {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  // Debounced scroll for streaming
  const debouncedScroll = useMemo(() => {
    let timeoutId
    return () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [])

  useEffect(() => {
    if (streamingMessage) {
      debouncedScroll()
    }
  }, [streamingMessage, debouncedScroll])

  // Check if content looks like a security audit response
  const isSecurityAudit = (content) => {
    const securityKeywords = ['vulnerability', 'security', 'critical', 'high', 'medium', 'low', 'audit', 'exploit', 'risk']
    const lowerContent = content.toLowerCase()
    return securityKeywords.some(keyword => lowerContent.includes(keyword)) && 
           (lowerContent.includes('critical') || lowerContent.includes('vulnerability') || lowerContent.includes('security'))
  }

  // Optimized markdown renderer
  const MarkdownRenderer = React.memo(({ content, streaming = false }) => {
    if (!content && !streaming) return null

    if (!streaming && isSecurityAudit(content)) {
      return <SecurityAuditResults content={content} />
    }

    return (
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            h1: ({children}) => (
              <h1 className="text-xl font-semibold text-white mt-6 mb-3">
                {children}
              </h1>
            ),
            h2: ({children}) => (
              <h2 className="text-lg font-semibold text-white mt-4 mb-2">
                {children}
              </h2>
            ),
            h3: ({children}) => (
              <h3 className="text-base font-medium text-white mt-3 mb-2">
                {children}
              </h3>
            ),
            p: ({children}) => (
              <p className="text-gray-100 leading-relaxed mb-3">
                {children}
              </p>
            ),
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '')

              if (!inline && match) {
                return (
                  <div className="my-4 bg-black rounded-lg overflow-hidden">
                    <div className="bg-gray-800 px-4 py-2 text-xs text-gray-300 border-b border-gray-600">
                      {match[1]}
                    </div>
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      className="!mt-0 !mb-0 text-sm"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                )
              }

              return (
                <code className="bg-gray-800 text-red-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              )
            },
            ul: ({children}) => (
              <ul className="space-y-1 mb-3 ml-4 list-disc text-gray-100">
                {children}
              </ul>
            ),
            ol: ({children}) => (
              <ol className="space-y-1 mb-3 ml-4 list-decimal text-gray-100">
                {children}
              </ol>
            ),
            li: ({children}) => (
              <li className="text-gray-100">
                {children}
              </li>
            ),
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-gray-800 rounded-r">
                {children}
              </blockquote>
            ),
            strong: ({children}) => (
              <strong className="font-semibold text-white">
                {children}
              </strong>
            ),
          }}
        >
          {content}
        </ReactMarkdown>

        {streaming && (
          <div className="flex items-center space-x-1 mt-2">
            <div className="w-1 h-4 bg-white animate-pulse"></div>
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-800">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
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

          {messages.map((message, index) => (
            <div key={message.id} className={`group px-4 ${message.type === 'user' ? 'bg-gray-800' : 'bg-gray-700'}`}>
              <div className="max-w-3xl mx-auto py-6">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0">
                    {message.type === 'user' ? (
                      <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center text-white text-sm font-medium">
                        You
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-green-600 rounded-sm flex items-center justify-center text-white text-sm font-bold">
                        AI
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100">
                      {message.type === 'user' ? (
                        <div>
                          <p className="mb-3 whitespace-pre-wrap">{message.content}</p>
                          {message.code && (
                            <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-gray-600">
                              <div className="text-xs text-gray-400 mb-2">Smart Contract Code:</div>
                              <pre className="text-sm text-gray-200 font-mono overflow-x-auto">
                                <code>{message.code.length > 200 ? message.code.substring(0, 200) + '...' : message.code}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <MarkdownRenderer 
                            content={message.content} 
                            streaming={message.streaming} 
                          />
                          {/* Copy button */}
                          <button className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Streaming Message */}
          {isAnalyzing && (
            <div className="group px-4 bg-gray-700">
              <div className="max-w-3xl mx-auto py-6">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 rounded-sm flex items-center justify-center text-white text-sm font-bold">
                      AI
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100">
                      {streamingMessage ? (
                        <MarkdownRenderer 
                          content={streamingMessage} 
                          streaming={true} 
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-1 h-4 bg-white animate-pulse"></div>
                        </div>
                      )}
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
