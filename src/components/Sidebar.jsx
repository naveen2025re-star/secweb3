import React, { useState, useMemo } from 'react'
import { Plus, MessageSquare, MoreHorizontal, Edit3, Trash2, Search, Wallet, LogOut } from 'lucide-react'
import { useWeb3Auth } from '../hooks/useWeb3Auth'

const Sidebar = ({ user, conversations, activeConversation, onNewConversation, onSelectConversation }) => {
  const { logout } = useWeb3Auth()
  const [hoveredConversation, setHoveredConversation] = useState(null)
  const [query, setQuery] = useState('')

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const formatAddress = (address) => {
    if (!address || typeof address !== 'string' || address.length < 10) {
      return 'Unknown Address';
    }
    try {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    } catch {
      return 'Invalid Address';
    }
  }

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
    <div className="w-72 h-full bg-gray-950 backdrop-blur-sm text-white flex flex-col border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">SecWeb3</h2>
            <p className="text-xs text-gray-400">Smart Contract Auditor</p>
          </div>
        </div>

        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4" />
          <span>New Analysis</span>
        </button>
      </div>

      {/* User Profile Section */}
      {user && (
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.ensName || (user?.walletAddress ? formatAddress(user.walletAddress) : 'Unknown User')}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-gray-400">
                    {user?.subscriptionTier || 'Free'}
                  </p>
                  <span className="text-gray-500">•</span>
                  <p className="text-xs text-gray-400">
                    {user?.apiCallsCount || 0}/{user?.apiCallsLimit || 100} calls
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                      <span className="text-xs text-gray-500">{formatTime(conversation.timestamp)}</span>
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
    </div>
  )
}

export default Sidebar
