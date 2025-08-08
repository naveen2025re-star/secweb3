import React, { useState, useMemo } from 'react'
import { Plus, MessageSquare, MoreHorizontal, Edit3, Trash2, Search } from 'lucide-react'

const Sidebar = ({ conversations, activeConversation, onNewConversation, onSelectConversation }) => {
  const [hoveredConversation, setHoveredConversation] = useState(null)
  const [query, setQuery] = useState('')

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday' 
    if (diffInDays < 7) return `${diffInDays} days ago`
    return date.toLocaleDateString()
  }

  const truncateTitle = (title, maxLength = 28) => {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength) + '...'
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(q))
  }, [conversations, query])

  const groupedConversations = {
    'Today': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays === 0
    }),
    'Yesterday': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays === 1
    }),
    'Previous 7 days': filtered.filter(conv => {
      const diffInDays = Math.floor((new Date() - new Date(conv.timestamp)) / (1000 * 60 * 60 * 24))
      return diffInDays > 1 && diffInDays <= 7
    }),
  }

  return (
    <div className="w-64 h-full bg-gray-900 text-white flex flex-col">
      {/* New Chat Button */}
      <div className="p-3 space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 border border-gray-600 hover:bg-gray-800 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New chat</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-2">
          {Object.entries(groupedConversations).map(([timeGroup, convs]) => 
            convs.length > 0 && (
              <div key={timeGroup} className="space-y-1">
                <div className="text-xs text-gray-400 px-3 py-2 font-medium">
                  {timeGroup}
                </div>
                {convs.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredConversation(conversation.id)}
                    onMouseLeave={() => setHoveredConversation(null)}
                  >
                    <button
                      onClick={() => onSelectConversation(conversation.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors relative ${
                        activeConversation === conversation.id
                          ? 'bg-gray-800 text-white'
                          : 'hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-sm truncate">
                        {truncateTitle(conversation.title)}
                      </span>
                      <span className="text-[10px] text-gray-500">{formatTime(conversation.timestamp)}</span>
                    </button>

                    {/* Hover actions */}
                    {hoveredConversation === conversation.id && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                        <button className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button className="p-1 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 rounded-lg cursor-pointer">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              N
            </div>
            <span className="text-sm">naveen</span>
          </div>
          <MoreHorizontal className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

export default Sidebar
